export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq, pbAnd } from '@/lib/pocketbase'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

/**
 * GET /api/locations
 * 从 Excel 快照 (inventory_type = 99) + 产品规格推算各【具体库位/货架】的已用体积和使用率
 */
export async function GET(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId') || DEFAULT_TENANT

    // 1. 找最新快照日期 (找类型为 99 的 Excel 上传的数据)
    let snapDate = ''
    try {
      const latest = await pb.collection('inventory_snapshots').getFirstListItem(
        pbAnd(pbEq('tenant_id', tenantId), 'inventory_type = 99'),
        { sort: '-snapshot_date' }
      )
      const rawDate = latest?.snapshot_date || ''
      snapDate = rawDate ? rawDate.split(' ')[0] : ''
    } catch { /* 无数据 */ }

    if (!snapDate) {
      return NextResponse.json({ locations: [], snapshot_date: null, message: '尚无具体库位数据，请先上传包含库位号的 Excel 文件' })
    }

    // 2. 拉取当日上传的最新库位库存快照
    const invData = await pb.collection('inventory_snapshots').getFullList({
      filter: pbAnd(
        pbEq('tenant_id', tenantId),
        'inventory_type = 99', // 99 代表 Excel 按库位导入的库位快照
        `snapshot_date >= "${snapDate}" && snapshot_date <= "${snapDate} 23:59:59"`,
      ),
    })

    // 3. 拉取产品规格表（用于计算体积），这个是由原「产品库存」页面同步来的
    const specs = await pb.collection('product_specs').getFullList({
      filter: pbEq('tenant_id', tenantId)
    })
    const specMap: Record<string, { vol: number; w: number; name: string }> = {}
    for (const s of specs) {
      const vol = (s.length_cm || 0) * (s.width_cm || 0) * (s.height_cm || 0)
      specMap[s.sku] = { vol, w: s.weight_kg || 0, name: s.name || s.sku }
    }

    // 4. 按真实的【库位】聚合：库存量 × 体积 → 已用体积
    const locMap: Record<string, {
      location_code: string; warehouse_name: string
      total_qty: number; used_volume: number; total_weight: number
      sku_count: number; no_spec_skus: string[]
    }> = {}

    for (const inv of invData) {
      const loc = inv.location_code || '未分配库位'
      if (!locMap[loc]) {
        locMap[loc] = {
          location_code: loc,
          warehouse_name: inv.warehouse_name || '',
          total_qty: 0, used_volume: 0, total_weight: 0,
          sku_count: 0, no_spec_skus: [],
        }
      }
      const qty = inv.available_qty || 0
      const spec = specMap[inv.sku]
      locMap[loc].total_qty += qty
      locMap[loc].sku_count += 1
      if (spec && spec.vol > 0) {
        locMap[loc].used_volume  += qty * spec.vol
        locMap[loc].total_weight += qty * spec.w
      } else {
        locMap[loc].no_spec_skus.push(inv.sku)
      }
    }

    // 5. 读取用户手动设置的最大容积
    const locSettings: Record<string, any> = {}
    try {
      const saved = await pb.collection('locations').getFullList({
        filter: pbEq('tenant_id', tenantId),
      })
      for (const s of saved) locSettings[s.location_code] = s
    } catch { /* locations 表可能为空 */ }

    // 6. 合并计算使用率，生成返回结果
    const result = Object.values(locMap).map(loc => {
      const setting = locSettings[loc.location_code] || {}
      const maxVol = setting.max_volume_cm3 || 0
      const warningRatio = setting.warning_ratio || 0.85
      const usageRatio = maxVol > 0 ? loc.used_volume / maxVol : 0
      return {
        id: setting.id || loc.location_code,
        location_code:  loc.location_code,
        warehouse_name: loc.warehouse_name,
        warehouse_code: loc.warehouse_name, // 用作显示关联
        max_volume_cm3: maxVol,
        warning_ratio:  warningRatio,
        total_qty:      loc.total_qty,
        sku_count:      loc.sku_count,
        used_volume:    Math.round(loc.used_volume),
        total_weight:   parseFloat(loc.total_weight.toFixed(2)),
        usage_ratio:    parseFloat(Math.min(usageRatio, 1).toFixed(4)),
        is_empty:       loc.total_qty === 0,
        is_overload:    maxVol > 0 && loc.used_volume > maxVol,
        is_warning:     maxVol > 0 && usageRatio >= warningRatio && !( loc.used_volume > maxVol),
        no_spec_count:  loc.no_spec_skus.length,
        no_spec_skus:   loc.no_spec_skus.slice(0, 5), // 最多返回5个示例
        snapshot_date:  snapDate,
        has_settings:   !!setting.id,
      }
    }).sort((a, b) => a.location_code.localeCompare(b.location_code))

    // 把没有库存只有配置的空货架也展示出来 -> 是的，如果库位只有空架子，也要一并展示
    const resultLocCodes = new Set(result.map(r => r.location_code))
    for (const [code, setting] of Object.entries(locSettings)) {
      if (!resultLocCodes.has(code) && setting.is_active) {
        result.push({
          id: setting.id,
          location_code: code,
          warehouse_name: setting.warehouse_name || '',
          warehouse_code: setting.warehouse_code || '',
          max_volume_cm3: setting.max_volume_cm3 || 0,
          warning_ratio: setting.warning_ratio || 0.85,
          total_qty: 0,
          sku_count: 0,
          used_volume: 0,
          total_weight: 0,
          usage_ratio: 0,
          is_empty: true,
          is_overload: false,
          is_warning: false,
          no_spec_count: 0,
          no_spec_skus: [],
          snapshot_date: snapDate,
          has_settings: true,
        })
      }
    }

    result.sort((a, b) => a.location_code.localeCompare(b.location_code))

    return NextResponse.json({ locations: result, snapshot_date: snapDate })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

/**
 * PATCH /api/locations
 * 为货架库位手动设置最大容积和预警阈值
 */
export async function PATCH(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { location_code, max_volume_cm3, warning_ratio, tenant_id } = await req.json()
    if (!location_code) return NextResponse.json({ error: 'location_code 不能为空' }, { status: 400 })

    const tId = tenant_id || DEFAULT_TENANT
    const patch: any = { tenant_id: tId, location_code, is_active: true }
    if (max_volume_cm3 !== undefined) patch.max_volume_cm3 = max_volume_cm3
    if (warning_ratio  !== undefined) patch.warning_ratio  = warning_ratio

    // upsert
    let location: any
    try {
      const existing = await pb.collection('locations').getFirstListItem(
        `tenant_id="${tId}" && location_code="${location_code}"`
      )
      location = await pb.collection('locations').update(existing.id, patch)
    } catch {
      location = await pb.collection('locations').create(patch)
    }
    return NextResponse.json({ location })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

/**
 * POST /api/locations
 * 生成补货单
 */
export async function POST(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const body = await req.json()
    const { location_code, warehouse_code, trigger_reason, usage_ratio, tenant_id } = body
    if (!location_code) return NextResponse.json({ error: '库位编号不能为空' }, { status: 400 })
    const order = await pb.collection('replenishment_orders').create({
      tenant_id: tenant_id || DEFAULT_TENANT,
      location_code, warehouse_code: warehouse_code || '',
      trigger_reason: trigger_reason || '', usage_ratio: usage_ratio || 0, status: 'pending',
    })
    return NextResponse.json({ order }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
