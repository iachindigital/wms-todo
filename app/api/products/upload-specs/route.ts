export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq, pbAnd } from '@/lib/pocketbase'
import * as xlsx from 'xlsx'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

/**
 * 模糊搜索列名
 */
function findCol(keys: string[], ...candidates: string[]): string | null {
  for (const candidate of candidates) {
    const c = candidate.toLowerCase().trim()
    const found = keys.find(k => k.toLowerCase().trim().includes(c))
    if (found) return found
  }
  return null
}

function parseNum(val: any): number {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const str = val.toString().replace(/,/g, '').trim()
  const n = parseFloat(str)
  return isNaN(n) ? 0 : n
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const tenantId = formData.get('tenantId') as string || DEFAULT_TENANT
    const diagnose = formData.get('diagnose') === 'true'

    if (!file) {
      return NextResponse.json({ error: '未找到上传的文件' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = xlsx.read(buffer, { type: 'buffer', codepage: 65001 })
    const sheetName = workbook.SheetNames[0]

    const rawSheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: '' })
    const sheetData = rawSheet as any[]

    if (sheetData.length === 0) {
      return NextResponse.json({ error: 'Excel 空白或数据错误' }, { status: 400 })
    }

    const allKeys = Object.keys(sheetData[0])

    // 检测字段
    const skuCol    = findCol(allKeys, '产品编码', 'sku', '货号', '编码', 'product')
    const lengthCol = findCol(allKeys, '长', 'length')
    const widthCol  = findCol(allKeys, '宽', 'width')
    const heightCol = findCol(allKeys, '高', 'height')
    const weightCol = findCol(allKeys, '重', 'weight')
    const volCol    = findCol(allKeys, '体积', 'volume', '容积')
    const nameCol   = findCol(allKeys, '品名', '名称', 'name', 'productName')

    if (diagnose) {
      return NextResponse.json({
        diagnose: true,
        sheetName,
        totalRows: sheetData.length,
        allColumns: allKeys,
        detectedColumns: { skuCol, lengthCol, widthCol, heightCol, weightCol, volCol, nameCol },
        sampleRows: sheetData.slice(0, 3)
      })
    }

    if (!skuCol) {
      return NextResponse.json({
        error: `缺少 SKU/产品编码 列`,
        detected: { skuCol, lengthCol, widthCol, heightCol },
        allColumns: allKeys
      }, { status: 400 })
    }

    let importedRows = 0
    let updatedRows = 0
    let newRows = 0
    let skippedRows = 0

    const pb = await getPocketBase()

    // 拉取已有的 specs 加速更新
    const existing = await pb.collection('product_specs').getFullList({ filter: pbEq('tenant_id', tenantId) })
    const existMap = new Map(existing.map(e => [e.sku, e.id]))

    const recordsToProcess = []

    for (const row of sheetData) {
      const sku = (row[skuCol] || '').toString().trim()
      if (!sku) {
        skippedRows++
        continue
      }

      let l = parseNum(lengthCol ? row[lengthCol] : 0)
      let w = parseNum(widthCol ? row[widthCol] : 0)
      let h = parseNum(heightCol ? row[heightCol] : 0)
      const wt = parseNum(weightCol ? row[weightCol] : 0)
      const v = parseNum(volCol ? row[volCol] : 0)
      let name = nameCol ? (row[nameCol] || '').toString().trim() : sku

      // 如果没有给长宽高，但给了体积，把体积平均拆成均等正方体（近似）供基础计算用
      // 真实世界里箱子不是正方体，但既然算总容积这也能用。如果 L W H 全是 0 且 v > 0:
      if (l === 0 && w === 0 && h === 0 && v > 0) {
        const side = Math.pow(v, 1/3)
        l = w = h = parseFloat(side.toFixed(2))
      }

      recordsToProcess.push({ sku, l, w, h, wt, name })
      importedRows++
    }

    // 逐条插入或更新
    for (const item of recordsToProcess) {
      const { sku, l, w, h, wt, name } = item
      const id = existMap.get(sku)
      if (id) {
        try {
          await pb.collection('product_specs').update(id, {
            length_cm: l, width_cm: w, height_cm: h, weight_kg: wt
            // name: name // 不覆盖已有产品的名字
          })
          updatedRows++
        } catch (_) {}
      } else {
        try {
          await pb.collection('product_specs').create({
            tenant_id: tenantId,
            sku, name,
            length_cm: l, width_cm: w, height_cm: h, weight_kg: wt
          })
          newRows++
        } catch (_) {}
      }
    }

    return NextResponse.json({
      success: true,
      importedRows,
      updatedRows,
      newRows,
      skippedRows
    })
  } catch (err: any) {
    return NextResponse.json({ error: '解析或保存失败: ' + err.message }, { status: 500 })
  }
}
