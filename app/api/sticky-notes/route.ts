export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq } from '@/lib/pocketbase'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId') || DEFAULT_TENANT
    const items = await pb.collection('sticky_notes').getFullList({ filter: pbEq('tenant_id', tenantId), sort: '-created' })
    return NextResponse.json({ notes: items })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const body = await req.json()
    const note = await pb.collection('sticky_notes').create({
      tenant_id: body.tenant_id || DEFAULT_TENANT,
      content:   body.content   ?? '',
      color:     body.color     ?? '#fef08a',
      position:  body.position  ?? null,
    })
    return NextResponse.json({ note }, { status: 201 })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id 不能为空' }, { status: 400 })
    const note = await pb.collection('sticky_notes').update(id, updates)
    return NextResponse.json({ note })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 不能为空' }, { status: 400 })
    await pb.collection('sticky_notes').delete(id)
    return NextResponse.json({ success: true })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}
