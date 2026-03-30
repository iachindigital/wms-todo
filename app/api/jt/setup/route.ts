export const dynamic = "force-dynamic"
// One-time setup: hash the admin password if stored as plain text
import { NextResponse } from 'next/server'
import { getPocketBase } from '@/lib/pocketbase'
import { createHmac, randomBytes } from 'crypto'

export async function GET() {
  const pb = await getPocketBase()
  let row: any = null
  try {
    row = await pb.collection('jt_config').getFirstListItem(`k="admin_password"`)
  } catch {}
  const pwd = row?.v || ''
  // If not already hashed (no dot separator for salt)
  if (pwd && !pwd.includes('.')) {
    const salt = randomBytes(16).toString('hex')
    const hash = createHmac('sha256', salt).update(pwd).digest('hex')
    if (row) await pb.collection('jt_config').update(row.id, { v: `${hash}.${salt}` })
    return NextResponse.json({ done: true, msg: 'Password hashed successfully' })
  }
  return NextResponse.json({ done: false, msg: 'Already hashed or no password set' })
}
