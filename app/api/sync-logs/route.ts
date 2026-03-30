export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase } from '@/lib/pocketbase'

export async function GET(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { searchParams } = new URL(req.url)
    const limit  = parseInt(searchParams.get('limit') ?? '100')
    const result = await pb.collection('sync_logs').getList(1, limit, { sort: '-synced_at' })
    return NextResponse.json({ logs: result.items ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const body = await req.json()
    await pb.collection('sync_logs').create({
      trigger:       body.trigger       ?? 'manual',
      client_code:   body.client_code   ?? '',
      client_name:   body.client_name   ?? '',
      sync_type:     body.sync_type     ?? '',
      created_count: body.created       ?? 0,
      updated_count: body.updated       ?? 0,
      skipped_count: body.skipped       ?? 0,
      error:         body.error         ?? null,
      duration_ms:   body.duration_ms   ?? 0,
      synced_at:     new Date().toISOString(),
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
