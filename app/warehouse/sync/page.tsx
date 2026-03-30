'use client'
import { useState, useEffect, useCallback } from 'react'

interface Client { id:string; customer_code:string; customer_name:string; auth_status:number; last_synced_at:string|null }
interface SyncResult { created:number; updated:number; skipped:number; error?:string }
interface DbLog {
  id:number; synced_at:string; trigger:string
  client_code:string; client_name:string; sync_type:string
  created:number; updated:number; skipped:number
  error?:string; duration_ms:number
}

const SYNC_TYPES = [
  { key:'outbound',  label:'一件代发', icon:'🚚', desc:'出库单状态+物流跟踪号（最多1000条）' },
  { key:'inbound',   label:'入库单',   icon:'📦', desc:'入库单状态（最多1000条）' },
  { key:'returns',   label:'退件单',   icon:'↩️',  desc:'退件处理状态' },
  { key:'inventory', label:'库存预警', icon:'📊', desc:'可用库存≤10件自动预警' },
]
const TYPE_LABELS: Record<string,string> = {
  outbound:'一件代发', inbound:'入库单', returns:'退件单', inventory:'库存预警'
}
const TRIGGER_LABELS: Record<string,string> = {
  cron:'⏰ 计划任务', manual:'👆 手动', auto:'🔄 自动'
}

export default function WarehouseSyncPage() {
  const [clients,    setClients]    = useState<Client[]>([])
  const [loading,    setLoading]    = useState(true)
  const [syncing,    setSyncing]    = useState<string|null>(null)
  const [results,    setResults]    = useState<Record<string,any>>({})
  const [msgs,       setMsgs]       = useState<Record<string,{text:string;ok:boolean}>>({})
  const [globalMsg,  setGlobalMsg]  = useState<{text:string;ok:boolean}|null>(null)
  const [dbLogs,     setDbLogs]     = useState<DbLog[]>([])
  const [logsLoading,setLogsLoading]= useState(false)
  const [autoSync,   setAutoSync]   = useState(false)
  const [nextSyncIn, setNextSyncIn] = useState(0)
  const AUTO_INTERVAL = 2 * 60 * 60

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const r = await fetch('/api/sync-logs?limit=100')
      const d = await r.json()
      setDbLogs(d.logs ?? [])
    } finally { setLogsLoading(false) }
  }, [])

  const fetchClients = useCallback(() =>
    fetch('/api/oms-clients').then(r=>r.json()).then(d=>{
      setClients((d.clients??[]).filter((c:Client)=>c.auth_status===1))
    }), [])

  useEffect(()=>{
    Promise.all([
      fetchClients(),
      fetchLogs(),
    ]).finally(()=>setLoading(false))
    // 每60秒自动刷新日志（看到宝塔自动同步结果）
    const interval = setInterval(fetchLogs, 60000)
    return () => clearInterval(interval)
  }, [fetchClients, fetchLogs])

  // 自动同步倒计时
  useEffect(()=>{
    if(!autoSync) return
    setNextSyncIn(AUTO_INTERVAL)
    const tick = setInterval(()=>{
      setNextSyncIn(n=>{
        if(n<=1){ handleSyncAll('auto'); return AUTO_INTERVAL }
        return n-1
      })
    }, 1000)
    return ()=>clearInterval(tick)
  }, [autoSync]) // eslint-disable-line

  const fmtTime = (s:number) =>
    `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor((s%3600)/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  const doSync = async(client:Client, syncType:string) => {
    const key = `${client.id}-${syncType}`
    setSyncing(key)
    setMsgs(m=>({...m,[key]:{text:'同步中...',ok:true}}))
    try{
      const r = await fetch('/api/oms-clients/sync-data',{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({clientId:client.id, customerCode:client.customer_code, syncType})
      })
      const d = await r.json()
      const ok = !d.error
      setMsgs(m=>({...m,[key]:{text: ok?`✅ 同步完成`:`❌ ${d.error}`, ok}}))
      if(ok && d.results) setResults(prev=>({...prev,[key]:d.results}))
      // 写日志到DB（每次同步都写，包括全部skipped的情况）
      if(ok && d.results){
        for(const [t, v] of Object.entries(d.results as Record<string,SyncResult>)){
          await fetch('/api/sync-logs',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              trigger:'manual', client_code:client.customer_code, client_name:client.customer_name,
              sync_type:TYPE_LABELS[t]??t, created:v.created??0, updated:v.updated??0,
              skipped:v.skipped??0, error:v.error??null, duration_ms:0
            })
          }).catch(()=>{})
        }
      } else if(!ok){
        // 失败时也写日志
        await fetch('/api/sync-logs',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({
            trigger:'manual', client_code:client.customer_code, client_name:client.customer_name,
            sync_type:syncType, created:0, updated:0, skipped:0, error:d.error??'未知错误', duration_ms:0
          })
        }).catch(()=>{})
      }
    }catch(e:any){
      setMsgs(m=>({...m,[key]:{text:`❌ ${e.message}`,ok:false}}))
    }
    setSyncing(null)
    await fetchClients()
    await fetchLogs()
  }

  const handleSyncAll = async(triggerType='manual') => {
    if(syncing) return
    setGlobalMsg({text:'⟳ 正在同步全部客户，请勿关闭页面...', ok:true})
    let totalNew=0, totalUpd=0
    const freshClients:Client[] = await fetch('/api/oms-clients').then(r=>r.json())
      .then(d=>(d.clients??[]).filter((c:Client)=>c.auth_status===1))
    for(const client of freshClients){
      for(const type of SYNC_TYPES){
        const key=`${client.id}-${type.key}`
        setSyncing(key)
        setMsgs(m=>({...m,[key]:{text:'同步中...',ok:true}}))
        try{
          const r=await fetch('/api/oms-clients/sync-data',{
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({clientId:client.id,customerCode:client.customer_code,syncType:type.key})
          })
          const d=await r.json()
          const ok=!d.error
          setMsgs(m=>({...m,[key]:{text:ok?`✅ 同步完成`:`❌ ${d.error}`,ok}}))
          if(ok&&d.results){
            setResults(prev=>({...prev,[key]:d.results}))
            Object.values(d.results as Record<string,SyncResult>).forEach(v=>{
              totalNew+=v.created??0; totalUpd+=v.updated??0
            })
          }
        }catch(e:any){
          setMsgs(m=>({...m,[key]:{text:`❌ ${e.message}`,ok:false}}))
        }
        setSyncing(null)
      }
      await fetchClients()
    }
    setGlobalMsg({text:`✅ 全部同步完成！新增 ${totalNew} 条，更新 ${totalUpd} 条 · ${new Date().toLocaleTimeString('zh-CN')}`, ok:true})
    await fetchLogs()
  }

  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>

      {/* 标题栏 */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>数据同步</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>从领星OMS拉取最新数据，每次最多1000条，同步后状态实时更新</p>
        </div>
        <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
          {/* 自动同步开关 */}
          <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 14px',borderRadius:'8px',
            background:autoSync?'#eff6ff':'#f8fafc',border:`1px solid ${autoSync?'#bfdbfe':'#e2e8f0'}`}}>
            <span style={{fontSize:'12px',color:autoSync?'#2563eb':'#64748b',fontWeight:600}}>
              {autoSync?`⏱ 自动 ${fmtTime(nextSyncIn)}`:'自动同步'}
            </span>
            <div onClick={()=>setAutoSync(v=>!v)}
              style={{width:'36px',height:'20px',borderRadius:'10px',background:autoSync?'#2563eb':'#cbd5e1',
                cursor:'pointer',position:'relative' as const,transition:'background 0.2s'}}>
              <div style={{width:'16px',height:'16px',borderRadius:'50%',background:'#fff',position:'absolute' as const,
                top:'2px',left:autoSync?'18px':'2px',transition:'left 0.2s'}}/>
            </div>
          </div>
          <button onClick={()=>handleSyncAll('manual')} disabled={!!syncing||loading}
            style={{padding:'9px 20px',borderRadius:'8px',background:syncing?'#e2e8f0':'#2563eb',border:'none',
              color:syncing?'#94a3b8':'white',fontWeight:600,fontSize:'13px',
              cursor:syncing?'not-allowed':'pointer',whiteSpace:'nowrap' as const}}>
            {syncing?'⟳ 同步中...':'↻ 同步全部客户'}
          </button>
        </div>
      </div>

      {globalMsg&&(
        <div style={{marginBottom:'16px',padding:'12px 16px',borderRadius:'8px',
          background:globalMsg.ok?'#f0fdf4':'#fef2f2',
          border:`1px solid ${globalMsg.ok?'#bbf7d0':'#fecaca'}`,
          color:globalMsg.ok?'#16a34a':'#dc2626',fontSize:'13px',fontWeight:500}}>
          {globalMsg.text}
        </div>
      )}

      {/* 客户卡片 */}
      {loading?<div style={{...card,padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>加载中...</div>
      :clients.length===0?(
        <div style={{...card,padding:'40px',textAlign:'center' as const}}>
          <div style={{color:'#94a3b8',fontSize:'13px',marginBottom:'12px'}}>暂无已绑定AppKey的客户</div>
          <a href="/warehouse/clients" style={{color:'#2563eb',fontSize:'13px'}}>前往客户管理绑定 →</a>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column' as const,gap:'16px',marginBottom:'24px'}}>
          {clients.map(client=>(
            <div key={client.id} style={card}>
              <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontSize:'14px',fontWeight:700,color:'#0f172a'}}>{client.customer_name}</span>
                <span style={{fontSize:'11px',color:'#94a3b8',padding:'1px 6px',background:'#f1f5f9',borderRadius:'4px'}}>{client.customer_code}</span>
                {client.last_synced_at&&(
                  <span style={{fontSize:'11px',color:'#94a3b8',marginLeft:'auto'}}>
                    上次同步：{new Date(client.last_synced_at).toLocaleString('zh-CN')}
                  </span>
                )}
              </div>
              <div style={{padding:'14px 18px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px'}}>
                {SYNC_TYPES.map(type=>{
                  const key=`${client.id}-${type.key}`
                  const busy=syncing===key
                  const msg=msgs[key]
                  const res=results[key]?.[type.key] as SyncResult|undefined
                  return(
                    <div key={type.key} style={{padding:'12px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'4px'}}>
                        <span style={{fontSize:'16px'}}>{type.icon}</span>
                        <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>{type.label}</span>
                      </div>
                      <div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'8px'}}>{type.desc}</div>
                      {msg&&(
                        <div style={{fontSize:'11px',color:msg.ok?'#16a34a':'#dc2626',marginBottom:'6px',lineHeight:1.6}}>
                          {msg.ok?'✅ 同步完成':msg.text}
                          {res&&!res.error&&(
                            <div style={{color:'#64748b',marginTop:'2px',display:'flex',gap:'8px'}}>
                              <span>新增 <strong style={{color:'#2563eb'}}>{res.created}</strong></span>
                              <span>更新 <strong style={{color:'#d97706'}}>{res.updated}</strong></span>
                              <span style={{color:'#94a3b8'}}>跳过 {res.skipped}</span>
                            </div>
                          )}
                          {res?.error&&<div style={{color:'#dc2626',fontSize:'10px',marginTop:'2px'}}>{res.error}</div>}
                        </div>
                      )}
                      <button onClick={()=>doSync(client,type.key)} disabled={!!syncing}
                        style={{width:'100%',padding:'6px',borderRadius:'6px',border:'1px solid #bfdbfe',
                          background:busy?'#e0f2fe':'#eff6ff',color:busy?'#0284c7':'#2563eb',
                          cursor:syncing?'not-allowed':'pointer',fontSize:'12px',fontWeight:600,fontFamily:'inherit'}}>
                        {busy?'⟳ 同步中...':'↻ 同步'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 同步日志（来自数据库，包含宝塔计划任务结果）── */}
      <div style={card}>
        <div style={{padding:'12px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <span style={{fontSize:'14px',fontWeight:700,color:'#0f172a'}}>📋 同步日志</span>
            <span style={{marginLeft:'10px',fontSize:'11px',color:'#94a3b8'}}>含宝塔计划任务 · 每60秒自动刷新 · 保留7天</span>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            {logsLoading&&<span style={{fontSize:'11px',color:'#94a3b8'}}>刷新中...</span>}
            <button onClick={fetchLogs}
              style={{padding:'4px 12px',borderRadius:'5px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#2563eb',fontSize:'11px',cursor:'pointer',fontWeight:500}}>
              ↻ 刷新
            </button>
          </div>
        </div>

        {dbLogs.length===0?(
          <div style={{padding:'24px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>
            {logsLoading?'加载中...':'暂无日志，同步后将自动记录（包括宝塔计划任务）'}
          </div>
        ):(
          <div style={{overflowX:'auto' as const,maxHeight:'400px',overflowY:'auto' as const}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'12px'}}>
              <thead style={{position:'sticky' as const,top:0,zIndex:1}}>
                <tr style={{background:'#f8fafc'}}>
                  {['同步时间','触发方式','客户','类型','新增','更新','跳过','耗时','状态'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',fontWeight:600,color:'#64748b',textAlign:'left' as const,
                      borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap' as const,fontSize:'11px'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dbLogs.map((log,i)=>(
                  <tr key={log.id} style={{borderBottom:'1px solid #f8fafc',background:i%2===0?'#fff':'#fafbfc'}}>
                    <td style={{padding:'7px 12px',color:'#64748b',whiteSpace:'nowrap' as const,fontSize:'11px'}}>
                      {new Date(log.synced_at).toLocaleString('zh-CN')}
                    </td>
                    <td style={{padding:'7px 12px',whiteSpace:'nowrap' as const}}>
                      <span style={{fontSize:'11px',color:'#475569'}}>
                        {TRIGGER_LABELS[log.trigger]??log.trigger}
                      </span>
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      <div style={{fontWeight:600,color:'#0f172a',fontSize:'12px'}}>{log.client_name}</div>
                      <div style={{color:'#94a3b8',fontSize:'10px',fontFamily:'monospace'}}>{log.client_code}</div>
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      <span style={{padding:'1px 7px',borderRadius:'4px',background:'#eff6ff',color:'#2563eb',fontSize:'11px',fontWeight:600}}>
                        {log.sync_type}
                      </span>
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      {log.created>0
                        ?<span style={{color:'#2563eb',fontWeight:700}}>+{log.created}</span>
                        :<span style={{color:'#94a3b8'}}>0</span>}
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      {log.updated>0
                        ?<span style={{color:'#d97706',fontWeight:700}}>↻{log.updated}</span>
                        :<span style={{color:'#94a3b8'}}>0</span>}
                    </td>
                    <td style={{padding:'7px 12px',color:'#94a3b8'}}>{log.skipped}</td>
                    <td style={{padding:'7px 12px',color:'#94a3b8',fontSize:'11px'}}>
                      {log.duration_ms>0?`${(log.duration_ms/1000).toFixed(1)}s`:'-'}
                    </td>
                    <td style={{padding:'7px 12px'}}>
                      {log.error
                        ?<span style={{color:'#dc2626',fontSize:'11px'}} title={log.error}>❌ 失败</span>
                        :<span style={{color:'#16a34a',fontSize:'11px'}}>✅ 成功</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{marginTop:'14px',padding:'10px 14px',background:'#fffbeb',borderRadius:'8px',border:'1px solid #fde68a',fontSize:'12px',color:'#92400e',lineHeight:1.8}}>
        <strong>⚠️ 提示：</strong>
        日志来源于数据库，宝塔计划任务执行的同步也会记录在此 ·
        「每日代发详情」状态来源本地DB，<strong>同步后自动更新</strong> ·
        每个类型最多同步1000条（20页×50条）
      </div>
    </div>
  )
}
