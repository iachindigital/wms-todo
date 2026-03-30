export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getPocketBase, pbEq, pbAnd, pbUpsert } from '@/lib/pocketbase'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'
const API_BASE       = 'https://api.xlwms.com/openapi'
const SYNC_SECRET    = process.env.SYNC_SECRET ?? ''

const PLATFORM_MAP: Record<string, string> = {
  '1':'AliExpress','2':'Amazon','3':'Amazon VC','4':'eBay','5':'Lazada',
  '6':'Shopee','7':'Shopify','8':'Walmart','9':'Wayfair','10':'MercadoLibre',
  '11':'Wish','12':'Other','14':'Woocommerce','15':'HomeDepot','20':'Shoplazza',
  '22':'TikTok','27':'Etsy','33':'Shein','34':'Temu',
}
const cleanTrackNo = (raw: string) => {
  if (!raw) return ''
  const r = raw.trim()
  if (r.startsWith('MEL') && r.includes('FMDOF')) return r.replace(/^MEL/,'').replace(/FMDOF\w+$/,'')||r
  return r
}

async function omsPost(appKey: string, appSecret: string, endpoint: string, data: Record<string,any>={}) {
  const reqTime  = String(Math.floor(Date.now()/1000))
  const authcode = generateAuthcode(appKey, appSecret, reqTime, data)
  const body     = Object.keys(data).length > 0 ? {appKey,data,reqTime} : {appKey,reqTime}
  const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const code = json.code ?? json.status
  if (code!==200&&code!==0&&code!=='200'&&code!=='0') throw new Error(`code=${code}: ${json.message??json.msg??''}`)
  return json.data ?? json
}

async function fetchPages(appKey: string, appSecret: string, endpoint: string,
  params: Record<string,any>={}, maxPageSize=50, maxPages=20): Promise<any[]> {
  const all:any[]=[]; let page=1
  while(page<=maxPages){
    const data  = await omsPost(appKey, appSecret, endpoint, {...params, page, pageSize:maxPageSize})
    const items:any[] = Array.isArray(data)?data:(data?.list??data?.records??data?.rows??[])
    all.push(...items)
    const total = Number(data?.total??data?.totalCount??0)
    if(items.length<maxPageSize||(total>0&&all.length>=total)) break
    page++
  }
  return all
}

async function writeLog(pb: any, entry: {
  trigger: string; client_code: string; client_name: string
  sync_type: string; created_count: number; updated_count: number; skipped_count: number
  error?: string; duration_ms: number
}) {
  try {
    await pb.collection('sync_logs').create({ ...entry, synced_at: new Date().toISOString() })
  } catch { /* 日志写失败不影响主流程 */ }
}

async function syncOne(pb: any, client: any, syncType: string, trigger: string) {
  const t0 = Date.now()
  const appKey    = decrypt(client.app_key)
  const appSecret = decrypt(client.app_secret)
  const code      = client.customer_code
  let created=0, updated=0, skipped=0, errorMsg=''

  try {
    if (syncType==='outbound') {
      const listOrders = await fetchPages(appKey, appSecret, '/v1/outboundOrder/pageList', {}, 50, 20)
      const BATCH=50
      for(let i=0; i<listOrders.length; i+=BATCH){
        const batch = listOrders.slice(i,i+BATCH).map((o:any)=>o.outboundOrderNo).filter(Boolean)
        if(!batch.length) continue
        try{
          const dData={outboundOrderNoList:batch}
          const dTime=String(Math.floor(Date.now()/1000))
          const dAuth=generateAuthcode(appKey,appSecret,dTime,dData)
          const dRes=await fetch(`${API_BASE}/v1/outboundOrder/detail?authcode=${dAuth}`,{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({appKey,data:dData,reqTime:dTime}),
            signal:AbortSignal.timeout(30000),
          })
          const dJson=await dRes.json()
          const details=Array.isArray(dJson.data)?dJson.data:[]
          for(const o of details){
            const no=String(o.outboundOrderNo??''); if(!no){skipped++;continue}
            const todoStatus=o.status===3?2:o.status===4?3:0
            const expressList=(o.expressList??[]).map((e:any)=>({trackNo:e.trackNo??'',weight:e.weight??0,length:e.length??0,width:e.width??0,height:e.height??0}))
            const expressNos=expressList.map((e:any)=>e.trackNo).filter(Boolean).map(cleanTrackNo)
            const rawNos=Array.isArray(o.logisticsTrackNos)&&o.logisticsTrackNos.length>0
              ?o.logisticsTrackNos.filter(Boolean).map(cleanTrackNo)
              :(o.logisticsTrackNo?[cleanTrackNo(o.logisticsTrackNo)]:[])
            const trackNos=expressNos.length>0?expressNos:rawNos
            const { action } = await pbUpsert(pb, 'todos',
              pbAnd(pbEq('tenant_id', DEFAULT_TENANT), pbEq('lingxing_order_no', no)),
              {
                tenant_id: DEFAULT_TENANT, customer_code: code,
                title:`【一件代发】${no}`, category:'出库作业', priority:2, status:todoStatus,
                lingxing_order_no:no, source:'lingxing_auto',
                description:`${o.salesPlatform??'-'}|${o.logisticsCarrier||'-'}|${o.receiver??'-'}`,
                extra_data:{
                  outboundOrderNo:no, apiStatus:o.status??0,
                  salesPlatform:String(o.salesPlatform??''),
                  salesPlatformName:PLATFORM_MAP[String(o.salesPlatform??'')]??String(o.salesPlatform??''),
                  logisticsChannel:o.logisticsChannel??'', logisticsCarrier:o.logisticsCarrier??'',
                  logisticsTrackNo:trackNos[0]??'', logisticsTrackNos:trackNos,
                  storeName:o.storeName??'', receiver:o.receiver??'',
                  cityName:o.cityName??'', provinceName:o.provinceName??'',
                  countryRegionCode:o.countryRegionCode??'', postCode:o.postCode??'',
                  addressOne:o.addressOne??'', orderCreateTime:o.orderCreateTime??'',
                  outboundTime:o.outboundTime??'', canceledTime:o.canceledTime??'',
                  whCode:o.whCode??'', platformOrderNo:o.platformOrderNo??'',
                  costTotal:o.costTotal??0,
                  productList:(o.productList??[]).map((p:any)=>({sku:p.sku??'',productName:p.productName??'',quantity:p.quantity??0})),
                  expressList,
                },
              }
            )
            if(action==='created')created++; else updated++
          }
        }catch{skipped++}
      }
    }

    if (syncType==='inbound') {
      const orders=await fetchPages(appKey,appSecret,'/v1/inboundOrder/pageList',{})
      for(const o of orders){
        if([4,5].includes(o.status)){skipped++;continue}
        const no=String(o.inboundOrderNo??o.orderNo??o.id??''); if(!no){skipped++;continue}
        const { action } = await pbUpsert(pb, 'todos',
          pbAnd(pbEq('tenant_id', DEFAULT_TENANT), pbEq('lingxing_order_no', no)),
          { tenant_id:DEFAULT_TENANT, customer_code:code,
            title:`【入库】${no}`, category:'入库作业', priority:o.status===3?1:2, status:0,
            lingxing_order_no:no, source:'lingxing_auto', description:`状态：${o.status}`, due_date:o.expectedDate??null }
        )
        if(action==='created')created++; else updated++
      }
    }

    if (syncType==='returns') {
      const orders=await fetchPages(appKey,appSecret,'/v1/returnOrder/pageList',{},50,20)
      for(const o of orders){
        if(o.status===4){skipped++;continue}
        const no=String(o.returnNo??o.id??''); if(!no){skipped++;continue}
        const { action } = await pbUpsert(pb, 'todos',
          pbAnd(pbEq('tenant_id', DEFAULT_TENANT), pbEq('lingxing_order_no', no)),
          { tenant_id:DEFAULT_TENANT, customer_code:code,
            title:`【退件】${no}`, category:'退货处理', priority:o.status===3?3:1,
            status:o.status===3?2:0, lingxing_order_no:no, source:'lingxing_auto', description:`退件|状态${o.status}` }
        )
        if(action==='created')created++; else updated++
      }
    }

    if (syncType==='inventory') {
      const today=new Date().toISOString().split('T')[0]
      const start=new Date(Date.now()-90*864e5).toISOString().split('T')[0]
      const items=await fetchPages(appKey,appSecret,'/v1/integratedInventory/pageOpen',
        {startTime:`${start} 00:00:00`,endTime:`${today} 23:59:59`})
      for(const item of items){
        const qty=Number(item.productStockDtl?.availableAmount??item.availableAmount??99)
        if(qty>10){skipped++;continue}
        const sku=String(item.sku??''); if(!sku){skipped++;continue}
        const { action } = await pbUpsert(pb, 'todos',
          pbAnd(pbEq('tenant_id', DEFAULT_TENANT), pbEq('lingxing_order_no', `inv_${code}_${sku}`)),
          { tenant_id:DEFAULT_TENANT, customer_code:code,
            title:`【库存预警】${sku} 剩余${qty}件`, category:'库存管理', priority:qty<=3?1:2, status:0,
            lingxing_order_no:`inv_${code}_${sku}`, source:'lingxing_auto', description:`SKU:${sku}|可用:${qty}` }
        )
        if(action==='created')created++; else updated++
      }
    }

  } catch(e:any) { errorMsg = e.message?.slice(0,200) ?? '未知错误' }

  await writeLog(pb, {
    trigger, client_code:code, client_name:client.customer_name,
    sync_type:syncType, created_count:created, updated_count:updated, skipped_count:skipped,
    error:errorMsg||undefined, duration_ms: Date.now()-t0,
  })
  return { created, updated, skipped, error:errorMsg||undefined }
}

async function runAll(syncType: string, trigger: string) {
  const pb = await getPocketBase()
  const clients = await pb.collection('oms_clients').getFullList({ filter: 'auth_status = 1', sort: 'customer_code' })
  if (!clients?.length) return
  const TYPES = syncType==='all' ? ['outbound','inbound','returns','inventory'] : [syncType]
  for(const client of clients){
    for(const t of TYPES) await syncOne(pb, client, t, trigger)
    await pb.collection('oms_clients').update(client.id, { last_synced_at: new Date().toISOString() })
  }
}

export async function POST(req: NextRequest) {
  if(SYNC_SECRET){
    const secret = req.headers.get('x-sync-secret') ?? ''
    if(secret !== SYNC_SECRET) return NextResponse.json({error:'密钥错误'},{status:401})
  }
  const body     = await req.json().catch(()=>({}))
  const syncType = body.syncType ?? 'all'
  const trigger  = body.trigger  ?? 'cron'
  runAll(syncType, trigger).catch(console.error)
  return NextResponse.json({ success:true, message:'同步任务已启动，结果将写入数据库日志', syncType, trigger, startedAt: new Date().toISOString() })
}

export async function GET(req: NextRequest) {
  if(SYNC_SECRET){
    const secret = req.headers.get('x-sync-secret') ?? new URL(req.url).searchParams.get('secret') ?? ''
    if(secret !== SYNC_SECRET) return NextResponse.json({error:'密钥错误'},{status:401})
  }
  return POST(req)
}
