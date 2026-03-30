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
    const items = await pb.collection('internal_tasks').getFullList({ filter: pbEq('tenant_id', tenantId), sort: '-created' })
    return NextResponse.json({ tasks: items })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const body = await req.json()
    const { title, deadline, source, content, opinion, type, priority, tenant_id } = body
    if (!title?.trim()) return NextResponse.json({ error: '标题不能为空' }, { status: 400 })
    const task = await pb.collection('internal_tasks').create({
      tenant_id: tenant_id || DEFAULT_TENANT,
      title: title.trim(), deadline: deadline || null,
      source: source || '', content: content || '', opinion: opinion || '',
      type: type || '通知', priority: priority || '一般', status: 'pending',
    })
    return NextResponse.json({ task }, { status: 201 })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const { id, ...updates } = await req.json()
    if (!id) return NextResponse.json({ error: 'id 不能为空' }, { status: 400 })
    const patch: any = {}
    if (updates.status  !== undefined) patch.status  = updates.status
    if (updates.title   !== undefined) patch.title   = updates.title
    if (updates.opinion !== undefined) patch.opinion = updates.opinion
    const task = await pb.collection('internal_tasks').update(id, patch)
    return NextResponse.json({ task })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 不能为空' }, { status: 400 })
    await pb.collection('internal_tasks').delete(id)
    return NextResponse.json({ success: true })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}
