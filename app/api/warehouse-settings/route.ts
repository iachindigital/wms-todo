export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq, pbUpsert } from '@/lib/pocketbase'

export async function GET() {
  try {
    const pb    = await getPocketBase()
    const items = await pb.collection('warehouse_settings').getFullList()
    const settings: Record<string, string> = {}
    for (const row of items) settings[row.key] = row.value ?? ''
    return NextResponse.json({ settings })
  } catch (err: any) {
    return NextResponse.json({ settings: {} })
  }
}

export async function POST(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const body = await req.json()
    for (const [key, value] of Object.entries(body)) {
      await pbUpsert(pb, 'warehouse_settings', pbEq('key', key), { key, value: String(value) })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
