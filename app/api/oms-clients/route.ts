export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq, pbAnd, pbLike } from '@/lib/pocketbase'
import { decrypt } from '@/lib/crypto'

export async function GET() {
  try {
    const pb = await getPocketBase()
    const clients = await pb.collection('oms_clients').getFullList({ sort: 'customer_code' })
    return NextResponse.json({ clients })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { customer_code, customer_name, oms_account, company_name } = await req.json()
    if (!customer_code || !customer_name) return NextResponse.json({ error: '客户代码和名称必填' }, { status: 400 })

    // 检查重复 customer_code
    try {
      const existing = await pb.collection('oms_clients').getFirstListItem(pbEq('customer_code', customer_code.trim()))
      if (existing) return NextResponse.json({ error: `客户代码 ${customer_code} 已存在` }, { status: 409 })
    } catch { /* not found = ok */ }

    const client = await pb.collection('oms_clients').create({
      customer_code: customer_code.trim(),
      customer_name: customer_name.trim(),
      oms_account:   oms_account?.trim() ?? '',
      company_name:  company_name?.trim() ?? '',
      status: 'active', auth_status: 0,
    })
    return NextResponse.json({ client }, { status: 201 })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 })
    await pb.collection('oms_clients').delete(id)
    return NextResponse.json({ success: true, message: '客户已删除' })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}

export async function PATCH(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { id, customer_code, customer_name, oms_account, company_name } = await req.json()
    if (!id || !customer_code || !customer_name) return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    await pb.collection('oms_clients').update(id, {
      customer_code: customer_code.trim(), customer_name: customer_name.trim(),
      oms_account: oms_account?.trim() ?? '', company_name: company_name?.trim() ?? '',
    })
    return NextResponse.json({ success: true, message: '客户信息已更新' })
  } catch (err: any) { return NextResponse.json({ error: err?.message }, { status: 500 }) }
}
