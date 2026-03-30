export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq, pbAnd, pbUpsert } from '@/lib/pocketbase'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { searchParams } = new URL(req.url)
    const tenantId  = searchParams.get('tenantId') || DEFAULT_TENANT
    const type      = parseInt(searchParams.get('type') || '1')
    const sku       = searchParams.get('sku') || ''
    const location  = searchParams.get('location') || ''
    const page      = parseInt(searchParams.get('page') || '1')
    const pageSize  = parseInt(searchParams.get('pageSize') || '50')

    // 找最新快照日期
    let snapDate = searchParams.get('date') || ''
    if (!snapDate) {
      try {
        const latest = await pb.collection('inventory_snapshots').getFirstListItem(
          pbAnd(pbEq('tenant_id', tenantId), `inventory_type = ${type}`),
          { sort: '-snapshot_date' }
        )
        const rawDate = latest?.snapshot_date || ''
        snapDate = rawDate ? rawDate.split(' ')[0] : new Date().toISOString().split('T')[0]
      } catch { snapDate = new Date().toISOString().split('T')[0] }
    }

    const conds = [
      pbEq('tenant_id', tenantId),
      `inventory_type = ${type}`,
      `snapshot_date >= "${snapDate}" && snapshot_date <= "${snapDate} 23:59:59"`,
    ]
    if (sku)      conds.push(`sku ~ "${sku.replace(/"/g, '\\"')}"`)
    if (location) conds.push(`location_code ~ "${location.replace(/"/g, '\\"')}"`)

    const result = await pb.collection('inventory_snapshots').getList(page, pageSize, {
      filter: conds.join(' && '),
      sort:   '-available_qty',
    })

    return NextResponse.json({ inventory: result.items, total: result.totalItems, page, pageSize, snapshot_date: snapDate })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
