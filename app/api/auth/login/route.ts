export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import PocketBase from 'pocketbase'

const PB_URL = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090'

/**
 * POST /api/auth/login
 * 使用 PocketBase Admin 账号登录，成功后写 HTTP-only cookie
 */
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: '邮箱和密码不能为空' }, { status: 400 })
    }

    const pb = new PocketBase(PB_URL)
    pb.autoCancellation(false)
    const auth = await pb.collection('users').authWithPassword(email, password)

    const res = NextResponse.json({ success: true, email: auth.record?.email })
    // 设置 HTTP-only cookie，安全存储 token
    res.cookies.set('pb_token', auth.token, {
      httpOnly: true,
      secure:   false, // 强制关闭 HTTPS 要求，保证任何环境都能写 cookie
      sameSite: 'lax',
      maxAge:   12 * 60 * 60,  // 12 小时
      path:     '/',
    })
    return res
  } catch (err: any) {
    const rawError = JSON.stringify(err?.response || {})
    return NextResponse.json({ 
      error: `PB报错: ${err?.message} - Details: ${rawError}` 
    }, { status: 401 })
  }
}

/**
 * DELETE /api/auth/login
 * 登出，清除 cookie
 */
export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set('pb_token', '', { maxAge: 0, path: '/' })
  return res
}
