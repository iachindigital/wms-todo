export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq, pbAnd } from '@/lib/pocketbase'
import * as xlsx from 'xlsx'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

/**
 * 在列名列表中，用模糊匹配找目标关键词
 * 返回第一个匹配的列名（原始名，含空格等），找不到返回 null
 */
function findCol(keys: string[], ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    const c = candidate.toLowerCase().trim()
    const found = keys.find(k => k.toLowerCase().trim().includes(c))
    if (found) return found
  }
  return null
}

/**
 * 解析数量字符串，容忍千位分隔符（1,234）和浮点数（取整）
 */
function parseQty(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return Math.floor(val)
  const str = val.toString().replace(/,/g, '').trim()
  const n = parseFloat(str)
  return isNaN(n) ? 0 : Math.floor(n)
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const tenantId = formData.get('tenantId') as string || DEFAULT_TENANT
    const diagnose = formData.get('diagnose') === 'true' // 诊断模式：只返回列名，不写库

    if (!file) {
      return NextResponse.json({ error: '未找到上传的文件' }, { status: 400 })
    }

    // 1. 读取并解析 Excel 文件
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = xlsx.read(buffer, { type: 'buffer', codepage: 65001 }) // UTF-8
    const sheetName = workbook.SheetNames[0]

    // 使用 raw: false 将所有值转为字符串，避免数字格式丢失
    const rawSheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' })
    const sheetData = rawSheet as any[]

    if (sheetData.length === 0) {
      return NextResponse.json({ error: 'Excel 表格为空，或所有数据行在表头之前' }, { status: 400 })
    }

    // 2. 自动检测列名
    const firstRow = sheetData[0]
    const allKeys = Object.keys(firstRow)

    // 关键列模糊匹配（按优先级排候选词）
    const skuCol       = findCol(allKeys, '产品编码', 'sku', '货号', '商品编码', '编码', '产品代码', 'product')
    const qtyCol       = findCol(allKeys, '实际库存', '库存数量', '可用库存', '当前库存', '数量', 'qty', 'quantity', '实际数量', '在库', '库存')
    const locationCol  = findCol(allKeys, '库位', '库位号', '库位编码', '货架', 'bin', 'cell', 'location', '位置')
    const warehouseCol = findCol(allKeys, '仓库', '仓库名称', '仓库代码', 'warehouse', 'wh')

    // 如果是诊断模式，直接返回诊断信息
    if (diagnose) {
      return NextResponse.json({
        diagnose: true,
        sheetName,
        totalRows: sheetData.length,
        allColumns: allKeys,
        detectedColumns: { skuCol, qtyCol, locationCol, warehouseCol },
        sampleRows: sheetData.slice(0, 3),
      })
    }

    // 如果找不到必要的列
    if (!skuCol || !qtyCol || !locationCol) {
      return NextResponse.json({
        error: `无法自动识别关键列！请检查 Excel 表头。`,
        detected: { skuCol, qtyCol, locationCol, warehouseCol },
        allColumns: allKeys,
        hint: '系统会自动寻找包含「产品编码/SKU」「实际库存/数量」「库位」关键字的列，请确认您的 Excel 含有这些列名。',
      }, { status: 400 })
    }

    // 3. 清理旧的 Excel 导入快照 (inventory_type = 99)
    const pb = await getPocketBase()
    const oldRecords = await pb.collection('inventory_snapshots').getFullList({
      filter: pbAnd(pbEq('tenant_id', tenantId), 'inventory_type = 99'),
    })
    for (const record of oldRecords) {
      try { await pb.collection('inventory_snapshots').delete(record.id) } catch (_) {}
    }

    // 4. 处理并保存新数据
    const today = new Date().toISOString().split('T')[0]
    let importedRows = 0
    let skippedRows = 0
    const recordsToInsert: any[] = []

    for (const row of sheetData) {
      const sku          = (row[skuCol] || '').toString().trim()
      const locationCode = (row[locationCol] || '').toString().trim()
      const qty          = parseQty(row[qtyCol])
      const warehouseName = warehouseCol ? (row[warehouseCol] || '').toString().trim() : ''

      // 跳过无效行（无SKU、无库位、或数量=0）
      if (!sku || !locationCode) {
        skippedRows++
        continue
      }

      // 数量为0的行也记录进来（代表货架有但是空了）
      recordsToInsert.push({
        tenant_id: tenantId,
        inventory_type: 99,
        sku,
        sku_name: '',
        location_code: locationCode,
        warehouse_code: warehouseName,
        warehouse_name: warehouseName,
        available_qty: qty,
        total_qty: qty,
        locked_qty: 0,
        snapshot_date: today + ' 00:00:00',
        synced_at: new Date().toISOString(),
      })
    }

    // 批量插入（每批50条，避免超时）
    const BATCH = 50
    for (let i = 0; i < recordsToInsert.length; i += BATCH) {
      const batch = recordsToInsert.slice(i, i + BATCH)
      await Promise.all(
        batch.map(record =>
          pb.collection('inventory_snapshots').create(record)
            .then(() => importedRows++)
            .catch(e => { console.error('insert error:', e); skippedRows++ })
        )
      )
    }

    // 5. 自动补全 locations 表（新库位建档）
    const uniqueLocations = Array.from(new Set(recordsToInsert.map(r => r.location_code)))
    const existingLocations = await pb.collection('locations').getFullList({ filter: pbEq('tenant_id', tenantId) })
    const existingLocSet = new Set(existingLocations.map(l => l.location_code))

    for (const loc of uniqueLocations) {
      if (!existingLocSet.has(loc)) {
        try {
          const whName = recordsToInsert.find(r => r.location_code === loc)?.warehouse_name || ''
          await pb.collection('locations').create({
            tenant_id: tenantId,
            location_code: loc,
            warehouse_code: whName,
            warehouse_name: whName,
            is_active: true,
            max_volume_cm3: 0,
            warning_ratio: 0.85,
          })
        } catch (_) {}
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedRows,
      skipped: skippedRows,
      totalRows: sheetData.length,
      detectedColumns: { skuCol, qtyCol, locationCol, warehouseCol },
      message: `成功导入 ${importedRows} 条库位数据！${skippedRows > 0 ? `（跳过了 ${skippedRows} 条无SKU/库位的行）` : ''}`,
    })

  } catch (err: any) {
    console.error('upload-excel error:', err)
    return NextResponse.json({ error: err?.message || '解析 Excel 发生错误' }, { status: 500 })
  }
}
