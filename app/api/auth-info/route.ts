export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/auth-info
 * 返回当前登录用户信息（支持代理登录 header）
 */
export async function GET(req: Request) {
  // 支持代理模式（X-Impersonate-Customer header）
  const impCustomer = req.headers.get('X-Impersonate-Customer')
  const impName     = req.headers.get('X-Impersonate-Name')
  if (impCustomer) {
    return NextResponse.json({
      role:         'client',
      customerCode: impCustomer,
      customerName: impName || impCustomer,
      displayName:  impName || impCustomer,
      email:        `${impCustomer.toLowerCase()}@client`,
      isActive:     true,
      isImpersonated: true,
    })
  }

  // 检查 PocketBase Admin token cookie
  const cookieStore = cookies()
  const token = cookieStore.get('pb_token')?.value
  if (!token) {
    return NextResponse.json({ role: 'guest' })
  }

  return NextResponse.json({
    role:  'warehouse_admin',
    email: 'admin',  // PocketBase admin
  })
}
