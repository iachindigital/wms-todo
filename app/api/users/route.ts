export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq } from '@/lib/pocketbase'
import PocketBase from 'pocketbase'

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090'

/**
 * GET /api/users
 * 返回 PocketBase Admin 列表（等同于 warehouse 用户）
 */
export async function GET() {
  try {
    const pb = await getPocketBase()
    // PocketBase Admins 列表
    const admins = await pb.admins.getFullList()
    const users = admins.map(a => ({
      id:           a.id,
      email:        a.email,
      display_name: a.email,
      role:         'warehouse_admin',
      is_active:    true,
      created_at:   a.created,
    }))
    return NextResponse.json({ users })
  } catch (err: any) {
    return NextResponse.json({ users: [] })
  }
}

/**
 * POST /api/users
 * 创建新的 PocketBase Admin 账号
 */
export async function POST(req: NextRequest) {
  try {
    const pb = await getPocketBase()
    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 })

    const admin = await pb.admins.create({ email, password })
    return NextResponse.json({ success: true, userId: admin.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '创建失败' }, { status: 500 })
  }
}
