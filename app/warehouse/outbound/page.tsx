'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'

const API_STATUS: Record<number,{label:string;color:string;bg:string}> = {
  0: {label:'待处理',   color:'#d97706', bg:'#fffbeb'},
  2: {label:'处理中',   color:'#2563eb', bg:'#eff6ff'},
  3: {label:'已出库',   color:'#16a34a', bg:'#f0fdf4'},
  4: {label:'已取消',   color:'#64748b', bg:'#f8fafc'},
  5: {label:'异常',     color:'#dc2626', bg:'#fef2f2'},
  7: {label:'面单异常', color:'#dc2626', bg:'#fef2f2'},
}

// ✅ FIX 问题2: 完整平台映射，同时支持数字code和字符串code
const PLATFORM_MAP: Record<string,string> = {
  '1':'AliExpress','2':'Amazon','3':'Amazon VC','4':'eBay','5':'Lazada',
  '6':'Shopee','7':'Shopify','8':'Walmart','9':'Wayfair','10':'MercadoLibre',
  '11':'Wish','12':'Other','14':'Woocommerce','15':'HomeDepot','16':'Overstock',
  '17':'Joom','18':'Tophatter','20':'Shoplazza','21':'Jumia','22':'TikTok',
  '23':'Xshoppy','24':'Shopline','25':'Allegro','27':'Etsy','28':'Allvalue',
  '29':'Fnac','30':'Rakuten','31':'Shoplus','32':'Sears','33':'Shein','34':'Temu','35':'Yahoo',
}

const getPlatform = (code: any, savedName?: string): string => {
  // 如果 savedName 是已知平台名（不是数字），直接用
  if (savedName && !/^\d+$/.test(savedName) && savedName !== '-') return savedName
  // 用 code 查 map
  const codeStr = String(code ?? '')
  if (PLATFORM_MAP[codeStr]) return PLATFORM_MAP[codeStr]
  // savedName 兜底
  if (savedName && savedName !== '-') return savedName
  return code ? `平台${code}` : '-'
}

interface Todo {
  id:string; title:string; status:number; customer_code:string|null
  created_at:string; lingxing_order_no:string|null
  extra_data: Record<string,any>|null
}
interface ClientInfo { customer_code:string; customer_name:string }

const fmtDate = (d:any) => {
  if(!d) return '-'
  try { return new Date(d).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) }
  catch { return String(d) }
}

const cleanTrackNo = (raw:string): string => {
  if(!raw) return ''
  const r = raw.trim()
  if(r.startsWith('MEL')&&r.includes('FMDOF')) return r.replace(/^MEL/,'').replace(/FMDOF\w+$/,'')||r
  return r
}

const getTrackNo = (e:Record<string,any>|null): string => {
  if(!e) return '-'
  const expList = e.expressList??[]
  const expNos = expList.map((x:any)=>cleanTrackNo(x.trackNo)).filter(Boolean)
  if(expNos.length>0) return expNos.join(' / ')
  if(Array.isArray(e.logisticsTrackNos)&&e.logisticsTrackNos.length>0) {
    const nos = e.logisticsTrackNos.map(cleanTrackNo).filter(Boolean)
    if(nos.length>0) return nos.join(' / ')
  }
  return cleanTrackNo(e.logisticsTrackNo)||'-'
}

type Col = {key:string;label:string;w:number;get:(t:Todo,clients:Record<string,string>)=>any;excel?:string}

const COLS: Col[] = [
  {key:'outboundOrderNo',  label:'出库单号',     w:170, excel:'Outbound Order No',
    get:t=><span style={{fontFamily:'monospace',fontSize:'11px',color:'#2563eb'}}>{t.lingxing_order_no??'-'}</span>},
  {key:'status',           label:'状态',         w:90,
    get:t=>{
      const apiStatus = t.extra_data?.apiStatus
      const info = apiStatus!==undefined ? (API_STATUS[apiStatus]??{label:'未知',color:'#94a3b8',bg:'#f8fafc'}) : (API_STATUS[t.status]??{label:'未知',color:'#94a3b8',bg:'#f8fafc'})
      return <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:info.bg,color:info.color,border:`1px solid ${info.color}33`,whiteSpace:'nowrap'}}>{t.extra_data?.statusName||info.label}</span>
    }},
  {key:'salesPlatform',    label:'销售平台',     w:130, excel:'Sale Platform',
    get:t=>getPlatform(t.extra_data?.salesPlatform, t.extra_data?.salesPlatformName)},
  {key:'storeName',        label:'店铺',         w:120, excel:'Store',           get:t=>t.extra_data?.storeName||'-'},
  {key:'customer',         label:'客户',         w:90,
    get:(t,clients)=>{
      const code = t.customer_code||''
      const name = clients[code]||''
      return <div><div style={{fontSize:'12px',color:'#0f172a',fontWeight:500}}>{name||code||'-'}</div>{name&&code&&<div style={{fontSize:'10px',color:'#94a3b8',fontFamily:'monospace'}}>{code}</div>}</div>
    }},
  {key:'platformOrderNo',  label:'平台单号',     w:180, excel:'Platform Number', get:t=>t.extra_data?.platformOrderNo||'-'},
  {key:'referOrderNo',     label:'参考单号',     w:160, excel:'Reference order No.', get:t=>t.extra_data?.referOrderNo||'-'},
  {key:'subOrderTypeName', label:'订单类型',     w:110,                          get:t=>t.extra_data?.subOrderTypeName||'-'},
  {key:'logisticsCarrier', label:'物流承运商',   w:140, excel:'Shipping Carrier', get:t=>t.extra_data?.logisticsCarrier||'-'},
  {key:'logisticsChannel', label:'物流渠道',     w:190, excel:'Shipping service', get:t=>t.extra_data?.logisticsChannel||'-'},
  {key:'logisticsTrackNo', label:'物流跟踪号',   w:180, excel:'Package 1 Tracking No.',
    get:t=><span style={{fontFamily:'monospace',fontWeight:600,fontSize:'12px'}}>{getTrackNo(t.extra_data)}</span>},
  {key:'receiver',         label:'收件人',       w:150, excel:'Recipient',       get:t=>t.extra_data?.receiver||'-'},
  {key:'telephone',        label:'电话',         w:120, excel:'Telephone',       get:t=>t.extra_data?.telephone||'-'},
  {key:'countryRegionCode',label:'国家',         w:60,  excel:'Country/Region',  get:t=>t.extra_data?.countryRegionCode||'-'},
  {key:'provinceName',     label:'省/州',        w:110, excel:'Province/State',
    get:t=>(t.extra_data?.provinceName||'').replace(/\(.*\)$/,'').trim()||'-'},
  {key:'cityName',         label:'城市',         w:100, excel:'City',            get:t=>t.extra_data?.cityName||'-'},
  {key:'postCode',         label:'邮编',         w:80,  excel:'Post code',       get:t=>t.extra_data?.postCode||'-'},
  {key:'addressOne',       label:'地址1',        w:220, excel:'Address1',        get:t=>t.extra_data?.addressOne||'-'},
  {key:'addressTwo',       label:'地址2',        w:160, excel:'Address2',        get:t=>t.extra_data?.addressTwo||'-'},
  {key:'whCode',           label:'仓库',         w:70,                           get:t=>t.extra_data?.whCode||'-'},
  {key:'productQty',       label:'总数量',       w:75,  excel:'Total Qty of SKU',
    get:t=>{const qty=(t.extra_data?.productList??[]).reduce((s:number,p:any)=>s+(Number(p.quantity)||0),0);return qty>0?qty:'-'}},
  {key:'productSku',       label:'SKU',          w:160, excel:'SKU 1 SKU',
    get:t=>{const list=t.extra_data?.productList??[];return list.length?list.map((p:any)=>`${p.sku}×${p.quantity}`).join(' | '):'-'}},
  {key:'productName',      label:'产品名称',     w:160, excel:'SKU 1 Product Name',
    get:t=>{const list=t.extra_data?.productList??[];return list.map((p:any)=>p.productName).filter(Boolean).join(', ')||'-'}},
  {key:'pkgWeight',        label:'包裹重量',     w:90,  excel:'Package 1 Weight',
    get:t=>{const list=t.extra_data?.expressList??[];return list.map((e:any)=>e.weight?`${e.weight}kg`:null).filter(Boolean).join(' / ')||'-'}},
  {key:'pkgSize',          label:'包裹尺寸',     w:140,
    get:t=>{const list=t.extra_data?.expressList??[];return list.map((e:any)=>e.length?`${e.length}×${e.width}×${e.height}cm`:null).filter(Boolean).join(' / ')||'-'}},
  {key:'costTotal',        label:'费用',         w:90,
    get:t=>t.extra_data?.costTotal?`${t.extra_data.costTotal} ${t.extra_data.costCurrencyCode||''}`.trim():'-'},
  {key:'remark',           label:'备注',         w:120, excel:'Remark',          get:t=>t.extra_data?.remark||'-'},
  {key:'orderCreateTime',  label:'创建时间',     w:145, excel:'Creation time',   get:t=>fmtDate(t.extra_data?.orderCreateTime||t.created_at)},
  {key:'outboundTime',     label:'出库时间',     w:145, excel:'OutboundTime',    get:t=>fmtDate(t.extra_data?.outboundTime)},
  {key:'canceledTime',     label:'取消时间',     w:145,                          get:t=>fmtDate(t.extra_data?.canceledTime)},
  {key:'exceptionDesc',    label:'异常原因',     w:150,                          get:t=>t.extra_data?.exceptionDesc||'-'},
]

const DEFAULT_COLS = ['outboundOrderNo','status','salesPlatform','logisticsCarrier','logisticsTrackNo','storeName','customer','receiver','countryRegionCode','cityName','productQty','productSku','platformOrderNo','orderCreateTime']
const PAGE_SIZE_OPTIONS = [50, 100, 200, 500]

export default function OutboundDetailPage() {
  const [todos,          setTodos]          = useState<Todo[]>([])
  const [clients,        setClients]        = useState<Record<string,string>>({})
  const [total,          setTotal]          = useState(0)
  const [loading,        setLoading]        = useState(true)
  const [showPicker,     setShowPicker]     = useState(false)
  const [visibleCols,    setVisibleCols]    = useState<string[]>(DEFAULT_COLS)
  const [search,         setSearch]         = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [page,           setPage]           = useState(1)
  const [pageSize,       setPageSize]       = useState(100)
  const [dragCol,        setDragCol]        = useState<string|null>(null)
  const [dragOver,       setDragOver]       = useState<string|null>(null)

  useEffect(()=>{ try{const s=localStorage.getItem('wms-ob-cols3');if(s)setVisibleCols(JSON.parse(s))}catch{} },[])
  const savePrefs = useCallback((cols:string[])=>{ setVisibleCols(cols); try{localStorage.setItem('wms-ob-cols3',JSON.stringify(cols))}catch{} },[])

  // 加载客户列表
  useEffect(()=>{
    fetch('/api/oms-clients').then(r=>r.json()).then(d=>{
      const map:Record<string,string>={}
      ;(d.clients??[]).forEach((c:ClientInfo)=>{ map[c.customer_code]=c.customer_name })
      setClients(map)
    })
  },[])

  // ✅ 问题3: 服务端分页，每次只拉当前页数据
  useEffect(()=>{
    setLoading(true)
    const p = new URLSearchParams({
      pageSize: String(pageSize),
      page:     String(page),
      category: '出库作业',
    })
    if(statusFilter) p.set('status', statusFilter)
    if(search)       p.set('search', search)
    fetch(`/api/todos?${p}`).then(r=>r.json()).then(d=>{
      setTodos(d.todos??[])
      setTotal(d.total??0)
      setLoading(false)
    })
  }, [page, pageSize, statusFilter, search])

  // search/filter 变化时回到第1页
  useEffect(()=>{ setPage(1) }, [search, statusFilter, platformFilter])

  const onDrop = (toKey:string) => {
    if(!dragCol||dragCol===toKey) return
    const o=[...visibleCols]; const f=o.indexOf(dragCol),t=o.indexOf(toKey)
    if(f===-1||t===-1) return
    o.splice(f,1); o.splice(t,0,dragCol); savePrefs(o); setDragCol(null); setDragOver(null)
  }

  // 前端平台筛选（在当前页数据里）
  const filtered = useMemo(()=>{
    if(!platformFilter) return todos
    return todos.filter(t=>getPlatform(t.extra_data?.salesPlatform,t.extra_data?.salesPlatformName)===platformFilter)
  },[todos, platformFilter])

  const platforms = useMemo(()=>[...new Set(todos.map(t=>getPlatform(t.extra_data?.salesPlatform,t.extra_data?.salesPlatformName)).filter(p=>p&&p!=='-'))].sort(),[todos])

  const activeCols = useMemo(()=>visibleCols.map(k=>COLS.find(c=>c.key===k)).filter(Boolean) as Col[], [visibleCols])
  const totalPages = Math.max(1, Math.ceil(total/pageSize))
  const noData = todos.length>0&&todos.every(t=>!t.extra_data?.receiver)

  const th:React.CSSProperties={padding:'9px 12px',fontSize:'11px',fontWeight:700,color:'#475569',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap' as const,background:'#f8fafc',position:'sticky' as const,top:0,zIndex:2,cursor:'grab',userSelect:'none' as const}
  const td:React.CSSProperties={padding:'8px 12px',fontSize:'12px',color:'#0f172a',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap' as const,maxWidth:'240px',overflow:'hidden',textOverflow:'ellipsis'}
  const sel:React.CSSProperties={padding:'6px 10px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',color:'#0f172a',cursor:'pointer',outline:'none',fontFamily:'inherit'}

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden',background:'#f8fafc'}}>

      {/* ── 顶部工具栏 ── */}
      <div style={{padding:'12px 20px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap' as const,marginBottom:'8px'}}>
          <Link href="/warehouse/dashboard" style={{color:'#94a3b8',textDecoration:'none',fontSize:'13px'}}>← 返回</Link>
          <span style={{color:'#e2e8f0'}}>/</span>
          <h1 style={{fontSize:'15px',fontWeight:700,color:'#0f172a'}}>一件代发 · 出库明细</h1>
          {/* 总数徽标 */}
          <span style={{padding:'1px 8px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'11px',fontWeight:600,border:'1px solid #bfdbfe'}}>
            共 {loading?'…':total} 条
          </span>
          {/* 各状态快速统计 */}
          {!loading && [0,2,3,4,5].map(s=>{
            const count = todos.filter(t=>(t.extra_data?.apiStatus??t.status)===s).length
            if(!count) return null
            const info = API_STATUS[s]
            return <span key={s} style={{padding:'1px 7px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:info.bg,color:info.color,border:`1px solid ${info.color}33`}}>
              {info.label} {count}
            </span>
          })}
          <div style={{flex:1}}/>
          {/* 搜索 */}
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="搜索单号/跟踪号/收件人..."
            style={{...sel,width:'210px'}}/>
          {/* 状态筛选 */}
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={sel}>
            <option value="">全部状态</option>
            {Object.entries(API_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          {/* 平台筛选 */}
          <select value={platformFilter} onChange={e=>setPlatformFilter(e.target.value)} style={sel}>
            <option value="">全部平台</option>
            {platforms.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          {/* 每页条数 */}
          <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}} style={sel}>
            {PAGE_SIZE_OPTIONS.map(n=><option key={n} value={n}>每页 {n} 条</option>)}
          </select>
          {/* 列设置 */}
          <button onClick={()=>setShowPicker(s=>!s)}
            style={{...sel,background:showPicker?'#eff6ff':'#fff',color:showPicker?'#2563eb':'#475569',fontWeight:500}}>
            ⚙ 列设置
          </button>
        </div>

        {/* 列选择器 */}
        {showPicker&&(
          <div style={{paddingTop:'10px',borderTop:'1px solid #f1f5f9'}}>
            <div style={{fontSize:'11px',color:'#64748b',marginBottom:'7px'}}>勾选显示列 · 拖动表头可调整顺序</div>
            <div style={{display:'flex',flexWrap:'wrap' as const,gap:'5px',marginBottom:'7px'}}>
              {COLS.map(col=>{
                const on=visibleCols.includes(col.key)
                return <label key={col.key} style={{display:'flex',alignItems:'center',gap:'3px',padding:'3px 8px',borderRadius:'4px',cursor:'pointer',background:on?'#eff6ff':'#f8fafc',border:`1px solid ${on?'#bfdbfe':'#e2e8f0'}`,fontSize:'11px',color:on?'#2563eb':'#6b7280',userSelect:'none' as const}}>
                  <input type="checkbox" checked={on} onChange={e=>{
                    let next=e.target.checked?[...visibleCols,col.key]:visibleCols.filter(k=>k!==col.key)
                    next=COLS.map(c=>c.key).filter(k=>next.includes(k)); savePrefs(next)
                  }} style={{accentColor:'#2563eb',margin:0}}/>{col.label}
                  {col.excel&&<span style={{fontSize:'9px',color:'#94a3b8',marginLeft:'2px'}}>↔Excel</span>}
                </label>
              })}
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              <button onClick={()=>savePrefs(COLS.map(c=>c.key))} style={{...sel,fontSize:'11px',padding:'4px 9px'}}>全选</button>
              <button onClick={()=>savePrefs(DEFAULT_COLS)}        style={{...sel,fontSize:'11px',padding:'4px 9px'}}>恢复默认</button>
            </div>
          </div>
        )}

        {noData&&!loading&&(
          <div style={{marginTop:'8px',padding:'7px 12px',borderRadius:'6px',background:'#fffbeb',border:'1px solid #fde68a',color:'#d97706',fontSize:'12px'}}>
            ⚠️ 数据缺少详情，请前往「数据同步」→「🚚 一件代发」重新同步
          </div>
        )}
      </div>

      {/* ── 表格主体 ── */}
      <div style={{flex:1,overflow:'auto'}}>
        {loading ? (
          <div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8',fontSize:'14px'}}>加载中...</div>
        ) : filtered.length===0 ? (
          <div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8',fontSize:'14px'}}>
            {search||statusFilter||platformFilter?'未找到匹配数据':'暂无数据，请先同步'}
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse' as const,background:'#fff'}}>
            <thead>
              <tr>
                <th style={{...th,minWidth:'40px',textAlign:'center' as const}}>#</th>
                {activeCols.map(col=>(
                  <th key={col.key} style={{...th,minWidth:`${col.w}px`,background:dragOver===col.key?'#dbeafe':'#f8fafc'}}
                    draggable
                    onDragStart={()=>setDragCol(col.key)}
                    onDragOver={e=>{e.preventDefault();setDragOver(col.key)}}
                    onDrop={()=>onDrop(col.key)}
                    onDragEnd={()=>{setDragCol(null);setDragOver(null)}}>
                    <span style={{display:'flex',alignItems:'center',gap:'3px'}}>
                      <span style={{color:'#d1d5db',fontSize:'9px'}}>⣿</span>{col.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t,i)=>{
                const apiSt = t.extra_data?.apiStatus
                const rowBg = apiSt===3?'#f0fdf4':apiSt===5?'#fef9f9':i%2===0?'#fff':'#fafbfc'
                return (
                  <tr key={t.id} style={{background:rowBg}}>
                    <td style={{...td,textAlign:'center' as const,color:'#94a3b8',fontSize:'11px',minWidth:'40px'}}>
                      {(page-1)*pageSize+i+1}
                    </td>
                    {activeCols.map(col=>(
                      <td key={col.key} style={td} title={typeof col.get(t,clients)==='string'?col.get(t,clients):undefined}>
                        {col.get(t,clients)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── 分页栏 ── */}
      <div style={{padding:'10px 20px',background:'#fff',borderTop:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <span style={{fontSize:'12px',color:'#64748b'}}>
          第 {(page-1)*pageSize+1}–{Math.min(page*pageSize,total)} 条，共 {total} 条
        </span>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          <button onClick={()=>setPage(1)} disabled={page<=1}
            style={{padding:'5px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:page<=1?'#f8fafc':'#fff',color:page<=1?'#cbd5e1':'#475569',cursor:page<=1?'not-allowed':'pointer',fontSize:'12px'}}>
            «
          </button>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}
            style={{padding:'5px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:page<=1?'#f8fafc':'#fff',color:page<=1?'#cbd5e1':'#475569',cursor:page<=1?'not-allowed':'pointer',fontSize:'12px'}}>
            ‹ 上一页
          </button>
          {/* 页码 */}
          {Array.from({length:Math.min(7,totalPages)},(_,i)=>{
            let p: number
            if(totalPages<=7) p=i+1
            else if(page<=4) p=i+1
            else if(page>=totalPages-3) p=totalPages-6+i
            else p=page-3+i
            if(p<1||p>totalPages) return null
            return (
              <button key={p} onClick={()=>setPage(p)}
                style={{padding:'5px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',
                  background:p===page?'#2563eb':'#fff',
                  color:p===page?'#fff':'#475569',
                  cursor:'pointer',fontSize:'12px',fontWeight:p===page?700:400,minWidth:'34px'}}>
                {p}
              </button>
            )
          })}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}
            style={{padding:'5px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:page>=totalPages?'#f8fafc':'#fff',color:page>=totalPages?'#cbd5e1':'#475569',cursor:page>=totalPages?'not-allowed':'pointer',fontSize:'12px'}}>
            下一页 ›
          </button>
          <button onClick={()=>setPage(totalPages)} disabled={page>=totalPages}
            style={{padding:'5px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:page>=totalPages?'#f8fafc':'#fff',color:page>=totalPages?'#cbd5e1':'#475569',cursor:page>=totalPages?'not-allowed':'pointer',fontSize:'12px'}}>
            »
          </button>
        </div>
        <span style={{fontSize:'12px',color:'#64748b'}}>共 {totalPages} 页</span>
      </div>
    </div>
  )
}
