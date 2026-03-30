export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbAnd, pbEq, pbLike, pbGetList } from '@/lib/pocketbase'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { searchParams } = new URL(req.url)
    const status       = searchParams.get('status')
    const category     = searchParams.get('category')
    const page         = parseInt(searchParams.get('page') || '1')
    const pageSize     = parseInt(searchParams.get('pageSize') || '100')
    const tenantId     = searchParams.get('tenantId') || DEFAULT_TENANT
    const customerCode = searchParams.get('customerCode')
    const search       = searchParams.get('search')

    const conds: string[] = [pbEq('tenant_id', tenantId)]
    if (status       !== null && status       !== '') conds.push(`status = ${parseInt(status)}`)
    if (category     !== null && category     !== '') conds.push(pbEq('category', category))
    if (customerCode !== null && customerCode !== '') conds.push(pbEq('customer_code', customerCode))
    if (search       !== null && search       !== '') conds.push(pbLike('title', search))

    const result = await pbGetList(pb, 'todos', {
      page, pageSize,
      filter: pbAnd(...conds),
      sort:   '-created',
    })

    // 附带 checklist_items（用 PB expand 或单独查询）
    const todoIds = result.items.map((t: any) => t.id)
    let checklistMap: Record<string, any[]> = {}
    if (todoIds.length > 0) {
      try {
        const clItems = await pb.collection('checklist_items').getFullList({
          filter: todoIds.map(id => `todo_id = "${id}"`).join(' || '),
          sort: 'sort_order',
        })
        for (const item of clItems) {
          if (!checklistMap[item.todo_id]) checklistMap[item.todo_id] = []
          checklistMap[item.todo_id].push(item)
        }
      } catch { /* checklist 查询失败不影响主数据 */ }
    }

    const todos = result.items.map((t: any) => ({
      ...t,
      checklist_items: checklistMap[t.id] ?? [],
    }))

    return NextResponse.json({ todos, total: result.total, page, pageSize })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '获取失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const body = await req.json()
    const { title, category, priority, due_date, description, checklist, tenant_id, lingxing_order_no } = body
    if (!title || !category) return NextResponse.json({ error: '标题和分类不能为空' }, { status: 400 })

    const todo = await pb.collection('todos').create({
      tenant_id: tenant_id || DEFAULT_TENANT,
      title, category,
      priority:          priority ?? 2,
      due_date:          due_date ?? null,
      description:       description ?? null,
      lingxing_order_no: lingxing_order_no ?? null,
      source:            'manual',
      status:            0,
    })

    if (checklist && Array.isArray(checklist) && checklist.length > 0) {
      for (let i = 0; i < checklist.length; i++) {
        await pb.collection('checklist_items').create({
          todo_id:    todo.id,
          content:    checklist[i].content,
          sort_order: i + 1,
        })
      }
    }
    return NextResponse.json({ todo }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '创建失败' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const pb   = await getPocketBase()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id 不能为空' }, { status: 400 })

    const patch: Record<string, any> = {}
    if (updates.status      !== undefined) {
      patch.status = updates.status
      if (updates.status === 2) patch.completed_at = new Date().toISOString()
    }
    if (updates.priority    !== undefined) patch.priority    = updates.priority
    if (updates.title       !== undefined) patch.title       = updates.title
    if (updates.due_date    !== undefined) patch.due_date    = updates.due_date
    if (updates.description !== undefined) patch.description = updates.description
    if (updates.category    !== undefined) patch.category    = updates.category
    if (updates.assigned_to !== undefined) patch.assigned_to = updates.assigned_to
    if (updates.assigned_at !== undefined) patch.assigned_at = updates.assigned_at

    const todo = await pb.collection('todos').update(id, patch)
    return NextResponse.json({ todo })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '更新失败' }, { status: 500 })
  }
}
