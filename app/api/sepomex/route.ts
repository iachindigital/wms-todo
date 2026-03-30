import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase } from '@/lib/pocketbase'

export async function GET(req: NextRequest) {
  const cp = new URL(req.url).searchParams.get('cp')?.trim()
  if (!cp || !/^\d{5}$/.test(cp)) {
    return NextResponse.json({ error: 'Ingresa un código postal de 5 dígitos' }, { status: 400 })
  }
  try {
    const pb = await getPocketBase()
    // PocketBase max perPage is 500, use getFullList with filter
    const rows = await pb.collection('mx_sepomex').getFullList({
      filter: `cp="${cp}"`,
      sort:   'colonia',
      fields: 'colonia,municipio,estado',
    })
    if (!rows.length) return NextResponse.json({ error: `No se encontró el CP ${cp}` }, { status: 404 })
    return NextResponse.json({
      cp,
      municipio: rows[0].municipio,
      estado:    rows[0].estado,
      colonias:  rows.map((d: any) => d.colonia),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
