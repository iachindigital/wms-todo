export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase } from '@/lib/pocketbase'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'
const API_BASE = 'https://api.xlwms.com/openapi'

// 从 oms_clients 取第一个已绑定的AppKey（支持指定 customerCode）
async function getTenantKeys(customerCode?: string) {
  const pb = await getPocketBase()
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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const code = json.code ?? json.status
  if (code !== 200 && code !== 0 && code !== '200' && code !== '0')
    throw new Error(`OMS code=${code} msg=${json.message ?? json.msg ?? ''}`)
  return json.data ?? json
}

/**
 * GET /api/inventory/stocktake
 * 查询盘点单信息（含库位 cellNo / areaNo）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerCode = searchParams.get('customerCode') || ''
    const pageNum  = parseInt(searchParams.get('pageNum') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')
    const orderSn  = searchParams.get('orderSn') || ''

    const keys = await getTenantKeys(customerCode || undefined)
    const params: Record<string, any> = { pageNum, pageSize }
    if (orderSn) params.orderSn = orderSn

    const data    = await omsRequest(keys.appKey, keys.appSecret, '/v1/integratedInventory/order/check/detail', params)
    const records = Array.isArray(data) ? data : (data?.records ?? data?.list ?? [])
    const total   = data?.total ?? records.length

    return NextResponse.json({ records, total, pageNum, pageSize })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

/**
 * POST /api/inventory/stocktake
 * 从盘点单同步库位信息到本地数据库
 */
export async function POST(req: NextRequest) {
  try {
    const body         = await req.json()
    const tenantId     = body.tenantId || DEFAULT_TENANT
    const customerCode = body.customerCode || ''
    const keys         = await getTenantKeys(customerCode || undefined)
    const pb           = await getPocketBase()

    // 拉取全部盘点单（最新一期）
    let allDetails: any[] = []
    let pageNum = 1
    while (true) {
      const data    = await omsRequest(keys.appKey, keys.appSecret, '/v1/integratedInventory/order/check/detail', { pageNum, pageSize: 50 })
      const records = Array.isArray(data) ? data : (data?.records ?? data?.list ?? [])
      for (const order of records) {
        const details = order.detailsList ?? []
        for (const d of details) {
          if (d.cellNo) allDetails.push({ ...d, orderSn: order.orderSn, warehouseCode: order.whCode })
        }
      }
      if (records.length < 50) break
      pageNum++
      await new Promise(r => setTimeout(r, 300))
    }

    if (allDetails.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: '无盘点单数据' })
    }

    // 提取唯一库位并 upsert 到 PocketBase
    const cellMap: Record<string, any> = {}
    for (const d of allDetails) {
      if (d.cellNo && !cellMap[d.cellNo]) {
        cellMap[d.cellNo] = {
          tenant_id:      tenantId,
          location_code:  d.cellNo,
          area_code:      d.areaNo    ?? '',
          area_type:      d.areaType  ?? null,
          area_type_name: d.areaTypeName ?? '',
          warehouse_code: d.warehouseCode ?? '',
          synced_at:      new Date().toISOString(),
        }
      }
    }

    const locationRows = Object.values(cellMap)
    let syncedCount = 0
    for (const row of locationRows) {
      try {
        const existing = await pb.collection('locations').getFirstListItem(
          `tenant_id="${row.tenant_id}" && location_code="${row.location_code}"`
        )
        await pb.collection('locations').update(existing.id, row)
      } catch {
        await pb.collection('locations').create(row)
      }
      syncedCount++
    }

    return NextResponse.json({ success: true, synced_locations: syncedCount, synced_details: allDetails.length })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
