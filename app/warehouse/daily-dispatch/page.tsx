'use client'
import { useState, useEffect, useMemo } from 'react'

interface CarrierRule {
  name: string; color: string; bg: string
  prefixes: string[]; minLen: number; maxLen: number; icon: string
}
const CARRIERS: CarrierRule[] = [
  { name:'MercadoLibre', color:'#d97706', bg:'#fffbeb', prefixes:['46'],       minLen:10, maxLen:13, icon:'🟡' },
  { name:'J&T Express',  color:'#dc2626', bg:'#fef2f2', prefixes:['GC','JMX'], minLen:14, maxLen:19, icon:'🔴' },
  { name:'iMile',        color:'#7c3aed', bg:'#f5f3ff', prefixes:['48','GC'],  minLen:13, maxLen:19, icon:'🟣' },
  { name:'其他',          color:'#64748b', bg:'#f8fafc', prefixes:[],           minLen:0,  maxLen:999,icon:'⚪' },
]
function detectCarrier(trackNo: string): string {
  if (!trackNo || trackNo === '-') return '其他'
  const t = trackNo.trim(), len = t.length
  for (const r of CARRIERS.slice(0, -1)) {
    const prefixMatch = r.prefixes.length === 0 || r.prefixes.some(p => t.startsWith(p))
    if (prefixMatch && len >= r.minLen && len <= r.maxLen) return r.name
  }
  return '其他'
}

interface Order {
  lingxing_order_no: string
  status: number
  customer_code: string
  extra_data: any
}
interface ClientInfo { customer_code: string; customer_name: string }

type SortField = 'orderCreateTime' | 'carrier' | 'customer'
type SortDir   = 'asc' | 'desc'

export default function DailyDispatchPage() {
  const [orders,    setOrders]    = useState<Order[]>([])
  const [clients,   setClients]   = useState<Record<string,string>>({})  // code→name
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<string|null>(null)
  const [sortField, setSortField] = useState<SortField>('orderCreateTime')
  const [sortDir,   setSortDir]   = useState<SortDir>('desc')

  useEffect(()=>{
    // 同时拉订单和客户列表
    Promise.all([
      fetch('/api/todos?pageSize=2000&category=出库作业').then(r=>r.json()),
      fetch('/api/oms-clients').then(r=>r.json()),
    ]).then(([d, c]) => {
      setOrders(d.todos ?? [])
      const map: Record<string,string> = {}
      ;(c.clients ?? []).forEach((cl: ClientInfo) => { map[cl.customer_code] = cl.customer_name })
      setClients(map)
      setLoading(false)
    })
  }, [])

  // 未出库订单
  const unshipped = useMemo(() => orders.filter(o => {
    const apiStatus = o.extra_data?.apiStatus ?? o.extra_data?.status
    return apiStatus !== 3 && apiStatus !== 4
  }), [orders])

  // 排序逻辑
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }
  const SortIcon = ({ field }: { field: SortField }) => (
    <span style={{marginLeft:'4px',color: sortField===field?'#2563eb':'#cbd5e1',fontSize:'10px'}}>
      {sortField===field ? (sortDir==='asc'?'▲':'▼') : '⇅'}
    </span>
  )

  const sortedUnshipped = useMemo(() => {
    return [...unshipped].sort((a, b) => {
      let va: any, vb: any
      if (sortField === 'orderCreateTime') {
        va = new Date(a.extra_data?.orderCreateTime || 0).getTime()
        vb = new Date(b.extra_data?.orderCreateTime || 0).getTime()
      } else if (sortField === 'carrier') {
        va = detectCarrier(a.extra_data?.logisticsTrackNo || '')
        vb = detectCarrier(b.extra_data?.logisticsTrackNo || '')
      } else if (sortField === 'customer') {
        va = a.customer_code || ''
        vb = b.customer_code || ''
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [unshipped, sortField, sortDir])

  // 按物流商分组（用于顶部卡片）
  const byCarrier: Record<string, Order[]> = {}
  for (const c of CARRIERS) byCarrier[c.name] = []
  for (const o of unshipped) {
    byCarrier[detectCarrier(o.extra_data?.logisticsTrackNo||'')].push(o)
  }
  const total = unshipped.length
  const ruleMap = CARRIERS.reduce((r,c)=>{ r[c.name]=c; return r },{} as Record<string,CarrierRule>)

  const card: React.CSSProperties = {background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}
  const thStyle = (field?: SortField): React.CSSProperties => ({
    padding:'8px 12px', fontWeight:600, color: field && sortField===field ? '#2563eb' : '#64748b',
    textAlign:'left' as const, borderBottom:'2px solid #e2e8f0',
    whiteSpace:'nowrap' as const, fontSize:'11px',
    cursor: field ? 'pointer' : 'default',
    userSelect: 'none' as const,
    background: field && sortField===field ? '#eff6ff' : '#f8fafc',
  })

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'24px 32px'}}>
      {/* 标题 */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>📋 每日代发详情</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>统计当天未出库包裹数，便于与物流公司核对交件数量</p>
        </div>
        <span style={{padding:'4px 14px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'12px',fontWeight:600,border:'1px solid #bfdbfe',alignSelf:'center'}}>
          {loading ? '…' : total} 件未出库
        </span>
      </div>

      {/* 物流商汇总卡片 */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
        {CARRIERS.map(c => {
          const count = byCarrier[c.name]?.length ?? 0
          const pct   = total > 0 ? Math.round(count/total*100) : 0
          return (
            <div key={c.name} style={{...card,padding:'16px 18px',borderLeft:`4px solid ${c.color}`,cursor:'pointer',
              boxShadow:expanded===c.name?`0 0 0 2px ${c.color}33`:'0 1px 3px rgba(0,0,0,0.05)'}}
              onClick={()=>setExpanded(expanded===c.name?null:c.name)}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
                <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>{c.icon} {c.name}</span>
                <span style={{fontSize:'11px',color:'#94a3b8'}}>{pct}%</span>
              </div>
              <div style={{fontSize:'32px',fontWeight:800,color:c.color,lineHeight:1}}>{loading?'…':count}</div>
              <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'5px'}}>未出库包裹</div>
              <div style={{marginTop:'10px',height:'4px',borderRadius:'2px',background:'#f1f5f9'}}>
                <div style={{height:'100%',borderRadius:'2px',background:c.color,width:`${pct}%`}}/>
              </div>
            </div>
          )
        })}
      </div>

      {/* 识别规则 */}
      <div style={{...card,padding:'10px 16px',marginBottom:'16px',background:'#f8fafc'}}>
        <span style={{fontSize:'12px',fontWeight:600,color:'#475569',marginRight:'16px'}}>📌 识别规则</span>
        {CARRIERS.slice(0,-1).map(c=>(
          <span key={c.name} style={{fontSize:'11px',color:'#64748b',marginRight:'20px'}}>
            <span style={{color:c.color,fontWeight:600}}>{c.icon} {c.name}：</span>
            {c.prefixes.length>0?`前缀 ${c.prefixes.join('/')}，`:''}长度 {c.minLen}–{c.maxLen} 位
          </span>
        ))}
      </div>

      {/* 按物流商展开详情 */}
      {CARRIERS.map(carrier => {
        const rows = byCarrier[carrier.name] ?? []
        if (expanded !== carrier.name || rows.length === 0) return null
        return (
          <div key={carrier.name} style={{...card,marginBottom:'14px',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',background:carrier.bg,borderBottom:`2px solid ${carrier.color}30`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'14px',fontWeight:700,color:carrier.color}}>{carrier.icon} {carrier.name} · {rows.length} 件</span>
              <button onClick={()=>setExpanded(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'18px'}}>×</button>
            </div>
            <div style={{overflowX:'auto' as const}}>
              <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'12px'}}>
                <thead><tr style={{background:'#f8fafc'}}>
                  {['出库单号','物流跟踪号','客户代码','客户名称','收件人','城市/州','平台','订单创建时间'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',fontWeight:600,color:'#64748b',textAlign:'left' as const,
                      borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap' as const,fontSize:'11px'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {rows.map((o,i) => {
                    const e = o.extra_data ?? {}
                    const apiSt = e.apiStatus
                    const stColor = apiSt===5?'#dc2626':apiSt===2?'#3b82f6':'#f97316'
                    const stLabel = apiSt===0?'待处理':apiSt===2?'处理中':apiSt===5?'异常':'未知'
                    return (
                      <tr key={o.lingxing_order_no} style={{borderBottom:'1px solid #f8fafc',background:i%2===0?'#fff':'#fafbfc'}}>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:'11px',color:'#2563eb',whiteSpace:'nowrap' as const}}>
                          {o.lingxing_order_no}
                          <span style={{marginLeft:'6px',padding:'1px 5px',borderRadius:'3px',background:`${stColor}15`,color:stColor,fontSize:'10px'}}>{stLabel}</span>
                        </td>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:600,whiteSpace:'nowrap' as const}}>{e.logisticsTrackNo||'-'}</td>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:'11px',color:'#64748b'}}>{o.customer_code||'-'}</td>
                        <td style={{padding:'9px 12px',fontSize:'12px',color:'#0f172a'}}>{clients[o.customer_code]||'-'}</td>
                        <td style={{padding:'9px 12px',whiteSpace:'nowrap' as const}}>{e.receiver||'-'}</td>
                        <td style={{padding:'9px 12px',color:'#64748b',whiteSpace:'nowrap' as const}}>{e.cityName||'-'}{e.provinceName?`, ${e.provinceName.replace(/\(.*\)/,'').trim()}`:''}</td>
                        <td style={{padding:'9px 12px',whiteSpace:'nowrap' as const}}>{e.salesPlatformName||e.salesPlatform||'-'}</td>
                        <td style={{padding:'9px 12px',whiteSpace:'nowrap' as const,color:'#64748b',fontSize:'11px'}}>
                          {e.orderCreateTime ? new Date(e.orderCreateTime).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* 全部未出库清单（带排序） */}
      {!loading && unshipped.length > 0 && (
        <div style={card}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>全部未出库清单（{total} 件）</span>
            <span style={{fontSize:'11px',color:'#94a3b8'}}>点击列标题排序 · 点击上方物流卡片查看详情</span>
          </div>
          <div style={{overflowX:'auto' as const,maxHeight:'500px',overflowY:'auto' as const}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'12px'}}>
              <thead style={{position:'sticky' as const,top:0,zIndex:1}}>
                <tr>
                  <th style={thStyle('carrier')} onClick={()=>toggleSort('carrier')}>物流公司 <SortIcon field="carrier"/></th>
                  <th style={thStyle()}>出库单号</th>
                  <th style={thStyle()}>物流跟踪号</th>
                  <th style={thStyle('customer')} onClick={()=>toggleSort('customer')}>客户代码 <SortIcon field="customer"/></th>
                  <th style={thStyle()}>客户名称</th>
                  <th style={thStyle()}>收件人</th>
                  <th style={thStyle()}>城市</th>
                  <th style={thStyle()}>平台</th>
                  <th style={thStyle('orderCreateTime')} onClick={()=>toggleSort('orderCreateTime')}>
                    订单创建时间 <SortIcon field="orderCreateTime"/>
                  </th>
                  <th style={thStyle()}>状态</th>
                </tr>
              </thead>
              <tbody>
                {sortedUnshipped.map((o, i) => {
                  const e        = o.extra_data ?? {}
                  const trackNo  = e.logisticsTrackNo || ''
                  const carrier  = detectCarrier(trackNo)
                  const rule     = ruleMap[carrier]
                  const apiSt    = e.apiStatus
                  const stLabel  = apiSt===0?'待处理':apiSt===2?'处理中':apiSt===5?'异常':'未知'
                  const stColor  = apiSt===5?'#dc2626':apiSt===2?'#3b82f6':'#f97316'
                  return (
                    <tr key={o.lingxing_order_no} style={{borderBottom:'1px solid #f8fafc',background:i%2===0?'#fff':'#fafbfc'}}>
                      <td style={{padding:'8px 12px',whiteSpace:'nowrap' as const}}>
                        <span style={{color:rule.color,fontWeight:600,fontSize:'11px'}}>{rule.icon} {carrier}</span>
                      </td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:'11px',color:'#475569'}}>{o.lingxing_order_no}</td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontWeight:600,color:'#0f172a'}}>{trackNo||'-'}</td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:'11px',color:'#64748b'}}>{o.customer_code||'-'}</td>
                      <td style={{padding:'8px 12px',fontSize:'12px',color:'#0f172a',whiteSpace:'nowrap' as const}}>{clients[o.customer_code]||'-'}</td>
                      <td style={{padding:'8px 12px',whiteSpace:'nowrap' as const}}>{e.receiver||'-'}</td>
                      <td style={{padding:'8px 12px',color:'#64748b',whiteSpace:'nowrap' as const}}>{e.cityName||'-'}</td>
                      <td style={{padding:'8px 12px',whiteSpace:'nowrap' as const}}>{e.salesPlatformName||e.salesPlatform||'-'}</td>
                      {/* ✅ 订单创建时间，可排序 */}
                      <td style={{padding:'8px 12px',whiteSpace:'nowrap' as const,color:'#64748b',fontSize:'11px'}}>
                        {e.orderCreateTime
                          ? new Date(e.orderCreateTime).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
                          : '-'}
                      </td>
                      <td style={{padding:'8px 12px',whiteSpace:'nowrap' as const}}>
                        <span style={{padding:'1px 7px',borderRadius:'4px',background:`${stColor}15`,color:stColor,fontSize:'10px',fontWeight:600}}>{stLabel}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
