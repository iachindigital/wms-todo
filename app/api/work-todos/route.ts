export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq, pbAnd } from '@/lib/pocketbase'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId') || DEFAULT_TENANT
    const items = await pb.collection('work_todos').getFullList({
      filter: pbEq('tenant_id', tenantId),
      sort:   '-created',
    })
    return NextResponse.json({ todos: items })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const body = await req.json()
    const { text, priority, tenant_id } = body
    if (!text?.trim()) return NextResponse.json({ error: '内容不能为空' }, { status: 400 })
    const todo = await pb.collection('work_todos').create({
      tenant_id: tenant_id || DEFAULT_TENANT,
      text: text.trim(),
      priority: priority || 'medium',
      done: false,
    })
    return NextResponse.json({ todo }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id 不能为空' }, { status: 400 })
    const patch: any = {}
    if (updates.done !== undefined) {
      patch.done   = updates.done
      patch.done_at = updates.done ? new Date().toISOString() : null
    }
    if (updates.text     !== undefined) patch.text     = updates.text
    if (updates.priority !== undefined) patch.priority = updates.priority
    const todo = await pb.collection('work_todos').update(id, patch)
    return NextResponse.json({ todo })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id 不能为空' }, { status: 400 })
    await pb.collection('work_todos').delete(id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
