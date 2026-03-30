export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import PocketBase from 'pocketbase'

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090'

/**
 * GET /api/auth-check
 * 检查当前会话是否有效（layout.tsx 调用）
 */
export async function GET() {
  const cookieStore = cookies()
  const token = cookieStore.get('pb_token')?.value
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 })

  try {
    const pb = new PocketBase(PB_URL)
    pb.autoCancellation(false)
    // 验证 admin token 有效性
    pb.authStore.save(token, null)
    if (!pb.authStore.isValid) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }
    return NextResponse.json({ authenticated: true })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
