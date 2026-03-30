export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase } from '@/lib/pocketbase'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'
const API_BASE = 'https://api.xlwms.com/openapi'

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
 * GET /api/inventory/flow
 * 分页查询库存流水（从领星实时拉取）
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerCode = searchParams.get('customerCode') || ''
    const sku      = searchParams.get('sku') || ''
    const pageNum  = parseInt(searchParams.get('pageNum') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '50')

    // 默认查近30天
    const now   = new Date()
    const start = searchParams.get('startTime') || new Date(now.getTime() - 30 * 864e5).toISOString().split('T')[0]
    const end   = searchParams.get('endTime')   || now.toISOString().split('T')[0]

    const keys = await getTenantKeys(customerCode || undefined)

    const params: Record<string, any> = {
      pageNum,
      pageSize,
      startTime: `${start} 00:00:00`,
      endTime:   `${end} 23:59:59`,
    }
    if (sku) params.stockSku = sku

    const data = await omsRequest(keys.appKey, keys.appSecret, '/v1/integratedInventory/pageStockFlow', params)
    const records = Array.isArray(data) ? data : (data?.records ?? data?.list ?? [])
    const total   = data?.total ?? records.length

    return NextResponse.json({ records, total, pageNum, pageSize })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
