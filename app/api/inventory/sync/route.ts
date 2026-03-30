export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq, pbAnd, pbUpsert } from '@/lib/pocketbase'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'
const API_BASE = 'https://api.xlwms.com/openapi'

// 从 oms_clients 取已绑定的AppKey（支持指定 customerCode，否则取第一个已绑定的）
async function getTenantKeys(pb: any, customerCode?: string) {
  let client: any = null
  try {
    if (customerCode) {
      client = await pb.collection('oms_clients').getFirstListItem(
        `customer_code="${customerCode}" && auth_status=1`
      )
    } else {
      client = await pb.collection('oms_clients').getFirstListItem(`auth_status=1`)
    }
  } catch {
    throw new Error('未找到已绑定的OMS客户凭证，请先在客户管理页绑定AppKey')
  }
  if (!client) throw new Error('未找到凭证')
  return { appKey: decrypt(client.app_key), appSecret: decrypt(client.app_secret) }
}

async function omsRequest(appKey: string, appSecret: string, endpoint: string, data: Record<string, any> = {}) {
  const reqTime  = String(Math.floor(Date.now() / 1000))
  const authcode = generateAuthcode(appKey, appSecret, reqTime, data)
  const body = Object.keys(data).length > 0 ? { appKey, data, reqTime } : { appKey, reqTime }
  const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const code = json.code ?? json.status
  if (code !== 200 && code !== 0 && code !== '200' && code !== '0')
    throw new Error(`OMS code=${code} msg=${json.message ?? json.msg ?? ''}`)
  return json.data ?? json
}

async function fetchAllPages(appKey: string, appSecret: string, endpoint: string, params: Record<string, any> = {}) {
  const all: any[] = []
  let pageNum = 1
  while (true) {
    const data = await omsRequest(appKey, appSecret, endpoint, { ...params, pageNum, pageSize: 50 })
    const items: any[] = Array.isArray(data) ? data : (data?.records ?? data?.list ?? [])
    all.push(...items)
    const total = data?.total ?? null
    if (items.length < 50) break
    if (total !== null && all.length >= Number(total)) break
    pageNum++
    await new Promise(r => setTimeout(r, 300))
  }
  return all
}

export async function POST(req: NextRequest) {
  try {
    const body         = await req.json()
    const tenantId     = body.tenantId || DEFAULT_TENANT
    const invType      = body.inventoryType ?? 1
    const customerCode = body.customerCode || ''
    const stockType    = invType - 1   // 领星: 0=产品,1=箱,2=退货

    const pb   = await getPocketBase()
    const keys = await getTenantKeys(pb, customerCode || undefined)
    const today = new Date().toISOString().split('T')[0]

    const items = await fetchAllPages(keys.appKey, keys.appSecret, '/v1/integratedInventory/pageOpen', { stockType })
    if (items.length === 0) return NextResponse.json({ success: true, synced: 0, message: '领星无库存数据' })

    let synced = 0
    for (const item of items) {
      const productDtl = item.productStockDtl ?? {}
      const boxDtl     = item.boxStockDtl     ?? {}
      const returnDtl  = item.fbaReturnStockDtl ?? {}
      let availableQty = 0, lockedQty = 0
      if (stockType === 0) { availableQty = Number(productDtl.availableAmount ?? 0); lockedQty = Number(productDtl.lockAmount ?? 0) }
      else if (stockType === 1) { availableQty = Number(boxDtl.availableAmount ?? 0); lockedQty = Number(boxDtl.lockAmount ?? 0) }
      else { availableQty = Number(returnDtl.availableAmount ?? 0); lockedQty = Number(returnDtl.lockAmount ?? 0) }

      const uniqueFilter = pbAnd(
        pbEq('tenant_id', tenantId),
        `inventory_type = ${invType}`,
        pbEq('sku', item.sku ?? ''),
        pbEq('location_code', ''),
        `snapshot_date >= "${today}" && snapshot_date <= "${today} 23:59:59"`,
      )
      await pbUpsert(pb, 'inventory_snapshots', uniqueFilter, {
        tenant_id: tenantId, inventory_type: invType,
        sku: item.sku ?? '', sku_name: item.productName ?? '',
        location_code: '', warehouse_code: item.whCode ?? '', warehouse_name: item.whName ?? '',
        available_qty: availableQty, total_qty: Number(item.totalAmount ?? 0),
        locked_qty: lockedQty, fnsku: item.fnsku ?? '', box_no: item.boxNo ?? '',
        snapshot_date: today + ' 00:00:00', synced_at: new Date().toISOString(), raw_data: item,
      })
      synced++
    }

    // 同步产品规格（仅产品库存时）
    if (invType === 1) {
      try {
        const products = await fetchAllPages(keys.appKey, keys.appSecret, '/v1/product/pagelist', {})
        for (const p of products) {
          if (!p.sku) continue
          await pbUpsert(pb, 'product_specs', pbAnd(pbEq('tenant_id', tenantId), pbEq('sku', p.sku)), {
            tenant_id: tenantId, sku: p.sku, name: p.productName ?? '',
            length_cm: Number(p.length ?? p.wmsLength ?? 0),
            width_cm:  Number(p.width  ?? p.wmsWidth  ?? 0),
            height_cm: Number(p.height ?? p.wmsHeight ?? 0),
            weight_kg: Number(p.weight ?? p.wmsWeight ?? 0),
            synced_at: new Date().toISOString(),
          })
        }
      } catch { /* 产品规格同步失败不阻断 */ }
    }

    return NextResponse.json({ success: true, synced, stockType, invType })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '同步失败' }, { status: 500 })
  }
}
