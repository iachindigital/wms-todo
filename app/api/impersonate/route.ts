import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase } from '@/lib/pocketbase'
import { randomBytes } from 'crypto'

// POST: warehouse admin generates a token to access a client portal
export async function POST(req: NextRequest) {
  const { customerCode } = await req.json()
  if (!customerCode) return NextResponse.json({ error: 'customerCode required' }, { status: 400 })

  const pb = await getPocketBase()

  // Get client info
  let client = null
  try {
    client = await pb.collection('oms_clients').getFirstListItem(`customer_code="${customerCode}"`)
  } catch {
    return NextResponse.json({ error: '客户不存在' }, { status: 404 })
  }

  // Generate a secure random token (32 bytes hex)
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  // Clean up old tokens for this customer
  try {
    const olds = await pb.collection('impersonate_tokens').getFullList({ filter: `customer_code="${customerCode}"` })
    for (const o of olds) await pb.collection('impersonate_tokens').delete(o.id)
  } catch (e) {}

  // Store token
  try {
    await pb.collection('impersonate_tokens').create({
      token,
      customer_code: customerCode,
      customer_name: client.customer_name,
      expires_at:    expiresAt.toISOString(),
      used:          false
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ token, expiresAt })
}

// GET: validate token and return customer info (used by client login page)
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const pb = await getPocketBase()

  let data = null
  try {
    data = await pb.collection('impersonate_tokens').getFirstListItem(`token="${token}" && used=false`)
  } catch {
    return NextResponse.json({ error: '无效或已过期的令牌' }, { status: 401 })
  }

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    try { await pb.collection('impersonate_tokens').delete(data.id) } catch (e) {}
    return NextResponse.json({ error: '令牌已过期，请重新点击进入' }, { status: 401 })
  }

  // Mark as used
  await pb.collection('impersonate_tokens').update(data.id, { used: true })

  return NextResponse.json({
    customerCode: data.customer_code,
    customerName: data.customer_name,
  })
}
