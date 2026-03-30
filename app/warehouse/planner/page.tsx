'use client'
import { useState, useEffect } from 'react'

interface PlanItem { id:string; text:string; done:boolean; quadrant:'urgent-important'|'important'|'urgent'|'neither'; createdAt:string }

const generateId = () => Math.random().toString(36).slice(2)

const QUADRANTS = [
  {key:'urgent-important', label:'重要紧急',   icon:'🔥', color:'#dc2626', bg:'#fef2f2', desc:'立即处理'},
  {key:'important',        label:'重要不紧急', icon:'📋', color:'#2563eb', bg:'#eff6ff', desc:'计划安排'},
  {key:'urgent',           label:'紧急不重要', icon:'👥', color:'#d97706', bg:'#fffbeb', desc:'授权他人'},
  {key:'neither',          label:'不重要不紧急',icon:'✅', color:'#16a34a', bg:'#f0fdf4', desc:'减少或删除'},
] as const

type QuadrantKey = typeof QUADRANTS[number]['key']

export default function PlannerPage() {
  const [items,       setItems]       = useState<PlanItem[]>([])
  const [showAdd,     setShowAdd]     = useState<QuadrantKey|null>(null)
  const [newText,     setNewText]     = useState('')
  const [filter,      setFilter]      = useState<'all'|'pending'|'done'>('pending')

  useEffect(()=>{ try{const s=localStorage.getItem('wms-planner-items');if(s)setItems(JSON.parse(s))}catch{} },[])
  const save = (next:PlanItem[]) => { setItems(next); try{localStorage.setItem('wms-planner-items',JSON.stringify(next))}catch{} }

  const addItem = (q:QuadrantKey) => {
    if(!newText.trim()) return
    save([{id:generateId(),text:newText.trim(),done:false,quadrant:q,createdAt:new Date().toISOString()},...items])
    setNewText(''); setShowAdd(null)
  }
  const toggle = (id:string) => save(items.map(t=>t.id===id?{...t,done:!t.done}:t))
  const remove  = (id:string) => save(items.filter(t=>t.id!==id))
  const move = (id:string, q:QuadrantKey) => save(items.map(t=>t.id===id?{...t,quadrant:q}:t))

  const getItems = (q:QuadrantKey) => items.filter(t=>t.quadrant===q&&(filter==='all'||(filter==='pending'&&!t.done)||(filter==='done'&&t.done)))
  const total = items.filter(t=>!t.done).length

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#f8fafc'}}>
      {/* 顶栏 */}
      <div style={{padding:'14px 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
          <h1 style={{fontSize:'16px',fontWeight:700,color:'#0f172a'}}>⊡ 待办计划</h1>
          {total>0&&<span style={{padding:'1px 8px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'11px',fontWeight:600,border:'1px solid #bfdbfe'}}>{total} 项待处理</span>}
        </div>
        <div style={{display:'flex',gap:'6px'}}>
          {(['all','pending','done'] as const).map(f=>(
            <button key={f} onClick={()=>setFilter(f)}
              style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #e2e8f0',fontSize:'12px',cursor:'pointer',fontWeight:500,fontFamily:'inherit',
                background:filter===f?'#2563eb':'#f8fafc',color:filter===f?'#fff':'#475569'}}>
              {f==='all'?'全部':f==='pending'?'待处理':'已完成'}
            </button>
          ))}
          <button onClick={()=>save(items.filter(t=>!t.done))} style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #e2e8f0',fontSize:'12px',cursor:'pointer',background:'#f8fafc',color:'#94a3b8',fontFamily:'inherit'}}>清除已完成</button>
        </div>
      </div>

      {/* 矩阵说明 */}
      <div style={{padding:'8px 24px',background:'#fffbeb',borderBottom:'1px solid #fde68a',fontSize:'12px',color:'#92400e',display:'flex',gap:'24px',flexShrink:0}}>
        <span style={{fontWeight:600}}>📐 十字管理矩阵</span>
        {QUADRANTS.map(q=><span key={q.key}><span style={{color:q.color,fontWeight:600}}>{q.icon} {q.label}</span>：{q.desc}</span>)}
      </div>

      {/* 四象限 */}
      <div style={{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:'1px',background:'#e2e8f0',overflow:'hidden'}}>
        {QUADRANTS.map(q=>{
          const qItems = getItems(q.key as QuadrantKey)
          return (
            <div key={q.key} style={{background:'#fff',display:'flex',flexDirection:'column',overflow:'hidden'}}>
              {/* 象限标题 */}
              <div style={{padding:'12px 16px',borderBottom:`2px solid ${q.color}20`,background:q.bg,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{fontSize:'18px'}}>{q.icon}</span>
                  <div>
                    <div style={{fontSize:'13px',fontWeight:700,color:q.color}}>{q.label}</div>
                    <div style={{fontSize:'10px',color:'#94a3b8'}}>{q.desc}</div>
                  </div>
                  {qItems.length>0&&<span style={{padding:'1px 6px',borderRadius:'20px',background:`${q.color}15`,color:q.color,fontSize:'11px',fontWeight:600}}>{qItems.length}</span>}
                </div>
                <button onClick={()=>{setShowAdd(q.key as QuadrantKey);setNewText('')}}
                  style={{width:'26px',height:'26px',borderRadius:'6px',background:`${q.color}15`,border:`1px solid ${q.color}30`,color:q.color,fontSize:'16px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>＋</button>
              </div>
              {/* 新增输入 */}
              {showAdd===q.key&&(
                <div style={{padding:'10px 14px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',display:'flex',gap:'8px'}}>
                  <input autoFocus value={newText} onChange={e=>setNewText(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter')addItem(q.key as QuadrantKey);if(e.key==='Escape')setShowAdd(null)}}
                    placeholder="输入任务内容，Enter确认..."
                    style={{flex:1,border:'1px solid #e2e8f0',borderRadius:'6px',padding:'6px 10px',fontSize:'12px',outline:'none',fontFamily:'inherit'}}/>
                  <button onClick={()=>addItem(q.key as QuadrantKey)}
                    style={{padding:'6px 12px',borderRadius:'6px',border:'none',background:q.color,color:'#fff',fontSize:'12px',cursor:'pointer',fontWeight:600,fontFamily:'inherit'}}>添加</button>
                  <button onClick={()=>setShowAdd(null)}
                    style={{padding:'6px 10px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#fff',color:'#64748b',fontSize:'12px',cursor:'pointer',fontFamily:'inherit'}}>取消</button>
                </div>
              )}
              {/* 任务列表 */}
              <div style={{flex:1,overflowY:'auto',padding:'8px'}}>
                {qItems.length===0?(
                  <div style={{padding:'20px',textAlign:'center',color:'#cbd5e1',fontSize:'12px'}}>暂无任务</div>
                ):(
                  qItems.map(item=>(
                    <div key={item.id} style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'8px 10px',borderRadius:'7px',marginBottom:'4px',
                      background:item.done?'#f8fafc':'#fff',border:'1px solid #f1f5f9'}}>
                      <input type="checkbox" checked={item.done} onChange={()=>toggle(item.id)}
                        style={{accentColor:q.color,marginTop:'2px',cursor:'pointer',flexShrink:0}}/>
                      <span style={{flex:1,fontSize:'13px',color:item.done?'#94a3b8':'#0f172a',textDecoration:item.done?'line-through':'none',lineHeight:1.4}}>{item.text}</span>
                      <div style={{display:'flex',gap:'3px',flexShrink:0}}>
                        {/* 移动到其他象限 */}
                        {QUADRANTS.filter(oq=>oq.key!==q.key).map(oq=>(
                          <button key={oq.key} onClick={()=>move(item.id,oq.key as QuadrantKey)}
                            title={`移到：${oq.label}`}
                            style={{background:'none',border:'none',color:'#cbd5e1',cursor:'pointer',fontSize:'12px',padding:'1px 3px',borderRadius:'3px'}}
                            onMouseEnter={e=>(e.currentTarget.style.color=oq.color)}
                            onMouseLeave={e=>(e.currentTarget.style.color='#cbd5e1')}>{oq.icon}</button>
                        ))}
                        <button onClick={()=>remove(item.id)}
                          style={{background:'none',border:'none',color:'#cbd5e1',cursor:'pointer',fontSize:'14px',padding:'1px 3px',borderRadius:'3px'}}
                          onMouseEnter={e=>(e.currentTarget.style.color='#ef4444')}
                          onMouseLeave={e=>(e.currentTarget.style.color='#cbd5e1')}>×</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
