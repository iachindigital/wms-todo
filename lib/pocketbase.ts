/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PocketBase 统一客户端
 * 替代原 lib/supabase-server.ts 和 lib/supabase-browser.ts
 *
 * 服务端（API Routes）：使用 Admin 凭证的单例，自动处理 token 刷新
 * 浏览器端（登录检查）：通过 Next.js API Routes 转发，浏览器不直接调用 PocketBase
 */
import PocketBase from 'pocketbase'

const PB_URL           = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090'
const PB_ADMIN_EMAIL   = process.env.POCKETBASE_ADMIN_EMAIL || ''
const PB_ADMIN_PASSWORD= process.env.POCKETBASE_ADMIN_PASSWORD || ''

// ── 服务端 Admin 单例（Next.js 进程级别，Token TTL=12h，提前 1h 刷新）
let _pb: PocketBase | null = null
let _authAt = 0
const AUTH_TTL = 11 * 60 * 60 * 1000  // 11 hours

export async function getPocketBase(): Promise<PocketBase> {
  if (!_pb) {
    _pb = new PocketBase(PB_URL)
    _pb.autoCancellation(false)
  }
  if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
    throw new Error('缺少 POCKETBASE_ADMIN_EMAIL 或 POCKETBASE_ADMIN_PASSWORD 环境变量')
  }
  if (Date.now() - _authAt > AUTH_TTL) {
    await _pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
    _authAt = Date.now()
  }
  return _pb
}

// ── PocketBase filter 辅助工具 ─────────────────────────────────────────
/** 对 PocketBase filter 中的字符串值转义引号 */
export const pbStr = (v: string): string => String(v ?? '').replace(/"/g, '\\"')

/** 构建等值 filter 条件：field = "value" */
export const pbEq = (field: string, value: string | number | boolean): string => {
  if (typeof value === 'string')  return `${field} = "${pbStr(value)}"`
  if (typeof value === 'boolean') return `${field} = ${value}`
  return `${field} = ${value}`
}

/** 构建模糊匹配：field ~ "value" */
export const pbLike = (field: string, value: string): string =>
  `${field} ~ "${pbStr(value)}"`

/** 合并多个 filter 条件 */
export const pbAnd = (...conds: (string | null | undefined)[]): string =>
  conds.filter(Boolean).join(' && ')

// ── 分页查询 wrapper（把 PB 的 getList 响应格式归一化）─────────────────
export async function pbGetList<T = any>(
  pb: PocketBase,
  collection: string,
  opts: {
    page?: number
    pageSize?: number
    filter?: string
    sort?: string
    expand?: string
  } = {}
): Promise<{ items: T[]; total: number; page: number; pageSize: number }> {
  const { page = 1, pageSize = 50, filter, sort, expand } = opts
  const result = await pb.collection(collection).getList<T>(page, pageSize, {
    filter: filter || '',
    sort:   sort   || '-created',
    ...(expand ? { expand } : {}),
  })
  return {
    items:    result.items,
    total:    result.totalItems,
    page:     result.page,
    pageSize: result.perPage,
  }
}

// ── Upsert 模拟（PocketBase 无原生 upsert）────────────────────────────
/**
 * 通过 uniqueFilter 找已有记录，有则 update，无则 create
 * @returns action: 'created' | 'updated'
 */
export async function pbUpsert(
  pb: PocketBase,
  collection: string,
  uniqueFilter: string,
  data: Record<string, any>
): Promise<{ record: any; action: 'created' | 'updated' }> {
  try {
    const existing = await pb.collection(collection).getFirstListItem(uniqueFilter)
    const record   = await pb.collection(collection).update(existing.id, data)
    return { record, action: 'updated' }
  } catch (err: any) {
    // 404 = not found → create
    if (err?.status === 404 || err?.message?.includes('The requested resource wasn')) {
      const record = await pb.collection(collection).create(data)
      return { record, action: 'created' }
    }
    throw err
  }
}

// ── 批量 upsert（同步用）────────────────────────────────────────────
export async function pbBatchUpsert(
  pb: PocketBase,
  collection: string,
  uniqueField: string,
  rows: Record<string, any>[]
): Promise<{ created: number; updated: number }> {
  let created = 0, updated = 0
  for (const row of rows) {
    const val = row[uniqueField]
    if (!val) continue
    const { action } = await pbUpsert(pb, collection, pbEq(uniqueField, String(val)), row)
    if (action === 'created') created++; else updated++
  }
  return { created, updated }
}
