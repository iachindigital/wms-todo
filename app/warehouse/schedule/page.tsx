'use client'
import { useState, useEffect } from 'react'

interface ScheduleItem {
  id:string; text:string; color:string; type:string; allDay:boolean
  startDate:string; endDate:string; startTime:string; endTime:string
  repeat:'none'|'weekly'|'monthly'; repeatDays:number[]; isRecurring?:boolean
  linkedTaskId?:string
}

const COLORS = ['#3b82f6','#f59e0b','#22c55e','#14b8a6','#ef4444','#6b7280']
const TYPES  = ['工作','会议','跟进','出行','学习','其他']
const DAYS   = ['周一','周二','周三','周四','周五','周六','周日']
const generateId = () => Math.random().toString(36).slice(2)

// Get days in month
function getDaysInMonth(year:number,month:number){
  return new Date(year,month+1,0).getDate()
}
function getFirstDayOfMonth(year:number,month:number){
  const d = new Date(year,month,1).getDay()
  return d===0?6:d-1 // Monday=0
}

export default function SchedulePage() {
  const [items,      setItems]      = useState<ScheduleItem[]>([])
  const [viewMode,   setViewMode]   = useState<'month'|'week'|'day'>('month')
  const [curDate,    setCurDate]    = useState(new Date())
  const [showNew,    setShowNew]    = useState(false)
  const [showRepeat, setShowRepeat] = useState(false)
  const [selDate,    setSelDate]    = useState<string|null>(null)

  const [form, setForm] = useState<Partial<ScheduleItem>>({
    color:'#3b82f6',type:'工作',allDay:false,
    startDate:'',endDate:'',startTime:'09:00',endTime:'10:00',
    repeat:'none',repeatDays:[],text:''
  })

  useEffect(()=>{ try{const s=localStorage.getItem('wms-schedule');if(s)setItems(JSON.parse(s))}catch{} },[])
  const save=(next:ScheduleItem[])=>{setItems(next);try{localStorage.setItem('wms-schedule',JSON.stringify(next))}catch{}}

  const addItem=()=>{
    if(!form.text?.trim()||!form.startDate) return
    const item:ScheduleItem={
      id:generateId(),text:form.text.trim(),color:form.color||'#3b82f6',
      type:form.type||'工作',allDay:form.allDay||false,
      startDate:form.startDate||'',endDate:form.endDate||form.startDate||'',
      startTime:form.startTime||'09:00',endTime:form.endTime||'10:00',
      repeat:form.repeat||'none',repeatDays:form.repeatDays||[],
    }
    save([...items,item])
    setForm({color:'#3b82f6',type:'工作',allDay:false,startDate:'',endDate:'',startTime:'09:00',endTime:'10:00',repeat:'none',repeatDays:[],text:''})
    setShowNew(false); setShowRepeat(false)
  }

  const removeItem=(id:string)=>save(items.filter(i=>i.id!==id))

  // Get items for a specific date
  const getItemsForDate=(dateStr:string)=>{
    const d = new Date(dateStr)
    const dow = d.getDay()===0?6:d.getDay()-1 // 0=Mon
    return items.filter(item=>{
      if(item.startDate===dateStr) return true
      if(item.repeat==='weekly'&&item.repeatDays.includes(dow)){
        return dateStr>=item.startDate&&dateStr<=item.endDate
      }
      if(item.repeat==='monthly'){
        const sd=new Date(item.startDate); const ed=new Date(item.endDate); const cd=new Date(dateStr)
        return cd>=sd&&cd<=ed&&sd.getDate()===cd.getDate()
      }
      return false
    })
  }

  const year=curDate.getFullYear(),month=curDate.getMonth()
  const daysInMonth=getDaysInMonth(year,month)
  const firstDay=getFirstDayOfMonth(year,month)
  const prevMonth=()=>setCurDate(new Date(year,month-1,1))
  const nextMonth=()=>setCurDate(new Date(year,month+1,1))
  const todayStr=new Date().toISOString().split('T')[0]

  const NEW_ITEM_BTN = (
    <button onClick={()=>{setShowNew(true);setForm(f=>({...f,startDate:selDate||todayStr,endDate:selDate||todayStr}))}}
      style={{padding:'8px 16px',borderRadius:'7px',background:'#2563eb',border:'none',color:'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
      ＋ 新建事项
    </button>
  )

  return (
    <div style={{flex:1,display:'flex',overflow:'hidden',background:'#f8fafc'}}>

      {/* 左侧面板 */}
      <div style={{width:'220px',flexShrink:0,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'16px',borderBottom:'1px solid #f1f5f9'}}>
          <h2 style={{fontSize:'14px',fontWeight:700,color:'#0f172a',marginBottom:'12px'}}>新建事项</h2>
          {/* 颜色选择 */}
          <div style={{display:'flex',gap:'6px',marginBottom:'10px',flexWrap:'wrap'}}>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                style={{width:'24px',height:'24px',borderRadius:'50%',background:c,cursor:'pointer',
                  border:form.color===c?`3px solid #0f172a`:'2px solid transparent',boxSizing:'border-box'}}/>
            ))}
          </div>
          <textarea value={form.text||''} onChange={e=>setForm(f=>({...f,text:e.target.value}))}
            placeholder="请输入事项内容..."
            rows={3}
            style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'8px',fontSize:'12px',
              resize:'vertical',outline:'none',fontFamily:'inherit',boxSizing:'border-box',marginBottom:'8px'}}/>
          <div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'8px'}}>
            {(form.text||'').length}/100 字符
          </div>
          <label style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px',cursor:'pointer'}}>
            <input type="checkbox" checked={form.allDay||false} onChange={e=>setForm(f=>({...f,allDay:e.target.checked}))} style={{accentColor:'#2563eb'}}/>
            <span style={{fontSize:'12px',color:'#475569'}}>AI创建</span>
          </label>
          <select value={form.type||''} onChange={e=>setForm(f=>({...f,type:e.target.value}))}
            style={{width:'100%',padding:'7px 10px',border:'1px solid #e2e8f0',borderRadius:'6px',fontSize:'12px',
              outline:'none',background:'#fff',marginBottom:'8px',cursor:'pointer',fontFamily:'inherit'}}>
            <option value="">类型（必选）</option>
            {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <select style={{width:'100%',padding:'7px 10px',border:'1px solid #e2e8f0',borderRadius:'6px',fontSize:'12px',outline:'none',background:'#fff',marginBottom:'10px',cursor:'pointer',fontFamily:'inherit'}}>
            <option value="">关联任务（可选）</option>
          </select>
          <div style={{display:'flex',gap:'6px'}}>
            <button onClick={()=>{setShowNew(true);setForm(f=>({...f,startDate:selDate||todayStr,endDate:selDate||todayStr}))}}
              style={{flex:1,padding:'8px',borderRadius:'6px',background:'#2563eb',border:'none',color:'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              ＋ 新建事项
            </button>
            <button onClick={()=>setShowRepeat(true)}
              style={{flex:1,padding:'8px',borderRadius:'6px',background:'#22c55e',border:'none',color:'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
              ↻ 循环任务
            </button>
          </div>
        </div>
        {/* 现有事项 */}
        <div style={{flex:1,overflowY:'auto',padding:'12px'}}>
          <div style={{fontSize:'11px',color:'#94a3b8',fontWeight:600,marginBottom:'8px'}}>现有事项</div>
          {items.length===0?(
            <div style={{fontSize:'11px',color:'#cbd5e1',textAlign:'center',padding:'16px'}}>暂无</div>
          ):(
            items.map(item=>(
              <div key={item.id} style={{padding:'8px',borderRadius:'6px',background:'#f8fafc',border:`1px solid ${item.color}30`,marginBottom:'6px',borderLeft:`3px solid ${item.color}`}}>
                <div style={{fontSize:'12px',color:'#0f172a',fontWeight:500,marginBottom:'2px'}}>{item.text}</div>
                <div style={{fontSize:'10px',color:'#94a3b8'}}>{item.startDate}{item.repeat!=='none'?` · ${item.repeat==='weekly'?'每周':'每月'}`:''}</div>
                <div style={{marginTop:'4px',display:'flex',justifyContent:'flex-end'}}>
                  <button onClick={()=>removeItem(item.id)} style={{background:'none',border:'none',color:'#cbd5e1',cursor:'pointer',fontSize:'12px'}}
                    onMouseEnter={e=>(e.currentTarget.style.color='#ef4444')}
                    onMouseLeave={e=>(e.currentTarget.style.color='#cbd5e1')}>删除</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧日历 */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* 日历工具栏 */}
        <div style={{padding:'12px 20px',background:'#fff',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
          <div style={{display:'flex',gap:'4px'}}>
            <button onClick={prevMonth} style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:'14px'}}>‹</button>
            <button onClick={nextMonth} style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:'14px'}}>›</button>
          </div>
          <h2 style={{fontSize:'18px',fontWeight:700,color:'#0f172a',flex:1,textAlign:'center'}}>{year}年{month+1}月</h2>
          <div style={{display:'flex',gap:'4px'}}>
            {(['month','week','day'] as const).map(v=>(
              <button key={v} onClick={()=>setViewMode(v)}
                style={{padding:'5px 12px',borderRadius:'6px',border:'none',fontSize:'12px',cursor:'pointer',fontWeight:500,fontFamily:'inherit',
                  background:viewMode===v?'#2563eb':'#f8fafc',color:viewMode===v?'#fff':'#475569'}}>
                {v==='month'?'月':v==='week'?'周':'日'}
              </button>
            ))}
          </div>
        </div>

        {/* 月视图 */}
        <div style={{flex:1,overflow:'auto',padding:'0'}}>
          {/* 星期标题 */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
            {DAYS.map(d=>(
              <div key={d} style={{padding:'8px',textAlign:'center',fontSize:'12px',fontWeight:600,color:'#64748b'}}>{d}</div>
            ))}
          </div>
          {/* 日期格子 */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',flex:1}}>
            {/* 空格 */}
            {Array.from({length:firstDay}).map((_,i)=>(
              <div key={`empty-${i}`} style={{borderBottom:'1px solid #f1f5f9',borderRight:'1px solid #f1f5f9',minHeight:'80px',background:'#fafbfc'}}/>
            ))}
            {/* 日期 */}
            {Array.from({length:daysInMonth}).map((_,i)=>{
              const day=i+1
              const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isToday=dateStr===todayStr
              const isSel=dateStr===selDate
              const dayItems=getItemsForDate(dateStr)
              return (
                <div key={day}
                  style={{borderBottom:'1px solid #f1f5f9',borderRight:'1px solid #f1f5f9',minHeight:'80px',padding:'4px',
                    background:isToday?'#fffef0':isSel?'#f0f7ff':'#fff',cursor:'pointer'}}
                  onClick={()=>setSelDate(dateStr)}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',marginBottom:'3px'}}>
                    <span style={{fontSize:'12px',fontWeight:isToday?700:400,
                      color:isToday?'#dc2626':'#0f172a',
                      width:'22px',height:'22px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                      background:isToday?'#fef2f2':'transparent'}}>
                      {day}
                    </span>
                  </div>
                  {dayItems.slice(0,3).map(item=>(
                    <div key={item.id} style={{fontSize:'10px',padding:'1px 4px',borderRadius:'3px',marginBottom:'1px',
                      background:`${item.color}20`,color:item.color,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {item.allDay?'':'⏰'}{item.text}
                    </div>
                  ))}
                  {dayItems.length>3&&<div style={{fontSize:'9px',color:'#94a3b8'}}>+{dayItems.length-3}项</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 新建事项弹窗 */}
      {showNew&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget){setShowNew(false)}}}>
          <div style={{background:'#fff',borderRadius:'12px',width:'440px',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'16px',fontWeight:700}}>新建事项</span>
              <button onClick={()=>setShowNew(false)} style={{background:'none',border:'none',fontSize:'20px',color:'#94a3b8',cursor:'pointer'}}>×</button>
            </div>
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'12px'}}>
              <input value={form.text||''} onChange={e=>setForm(f=>({...f,text:e.target.value}))}
                placeholder="事项内容"
                style={{border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit'}}/>
              <div style={{display:'flex',gap:'8px'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px'}}>开始日期</div>
                  <input type="date" value={form.startDate||''} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}
                    style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'8px 10px',fontSize:'12px',outline:'none',boxSizing:'border-box' as const}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px'}}>结束日期</div>
                  <input type="date" value={form.endDate||''} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}
                    style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'8px 10px',fontSize:'12px',outline:'none',boxSizing:'border-box' as const}}/>
                </div>
              </div>
              {!form.allDay&&(
                <div style={{display:'flex',gap:'8px'}}>
                  <div style={{flex:1}}><div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px'}}>开始时间</div><input type="time" value={form.startTime||'09:00'} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'8px 10px',fontSize:'12px',outline:'none',boxSizing:'border-box' as const}}/></div>
                  <div style={{flex:1}}><div style={{fontSize:'11px',color:'#64748b',marginBottom:'4px'}}>结束时间</div><input type="time" value={form.endTime||'10:00'} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))} style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'6px',padding:'8px 10px',fontSize:'12px',outline:'none',boxSizing:'border-box' as const}}/></div>
                </div>
              )}
              <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
                <input type="checkbox" checked={form.allDay||false} onChange={e=>setForm(f=>({...f,allDay:e.target.checked}))} style={{accentColor:'#2563eb'}}/>
                <span style={{fontSize:'12px',color:'#475569'}}>全天任务</span>
              </label>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {COLORS.map(c=><div key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:'24px',height:'24px',borderRadius:'50%',background:c,cursor:'pointer',border:form.color===c?'3px solid #0f172a':'2px solid transparent',boxSizing:'border-box'}}/>)}
              </div>
            </div>
            <div style={{padding:'16px 24px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'flex-end',gap:'10px'}}>
              <button onClick={()=>setShowNew(false)} style={{padding:'8px 18px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>取消</button>
              <button onClick={addItem} style={{padding:'8px 20px',borderRadius:'7px',border:'none',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 循环任务弹窗 */}
      {showRepeat&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget)setShowRepeat(false)}}>
          <div style={{background:'#fff',borderRadius:'12px',width:'520px',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{padding:'20px 24px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'16px',fontWeight:700}}>创建循环任务</span>
              <button onClick={()=>setShowRepeat(false)} style={{background:'none',border:'none',fontSize:'20px',color:'#94a3b8',cursor:'pointer'}}>×</button>
            </div>
            <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'}}>
              {/* 颜色 */}
              <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'8px',fontWeight:600}}>任务颜色</div>
                <div style={{display:'flex',gap:'10px'}}>{COLORS.map(c=><div key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:'32px',height:'32px',borderRadius:'50%',background:c,cursor:'pointer',border:form.color===c?'3px solid #0f172a':'2px solid transparent',boxSizing:'border-box'}}/>)}</div>
              </div>
              {/* 内容 */}
              <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'6px',fontWeight:600}}>任务内容</div>
                <input value={form.text||''} onChange={e=>setForm(f=>({...f,text:e.target.value}))} placeholder="请输入循环任务内容..."
                  style={{width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
              </div>
              {/* 类型 */}
              <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'6px',fontWeight:600}}>业务类型</div>
                <select value={form.type||''} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{width:'100%',padding:'10px 12px',border:'1px solid #e2e8f0',borderRadius:'8px',fontSize:'13px',outline:'none',background:'#fff',cursor:'pointer',fontFamily:'inherit'}}>
                  <option value="">请选择业务类型（必选）</option>
                  {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {/* 时间段 */}
              <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'6px',fontWeight:600}}>时间段</div>
                <div style={{display:'flex',gap:'8px'}}>
                  <input type="date" value={form.startDate||''} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{flex:1,border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}}/>
                  <input type="date" value={form.endDate||''} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} style={{flex:1,border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}}/>
                </div>
              </div>
              {/* 时间设置 */}
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'6px'}}>
                  <span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>时间设置</span>
                  <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer'}}>
                    <input type="checkbox" checked={form.allDay||false} onChange={e=>setForm(f=>({...f,allDay:e.target.checked}))} style={{accentColor:'#2563eb'}}/>
                    <span style={{fontSize:'12px',color:'#475569'}}>全天任务</span>
                  </label>
                </div>
                {!form.allDay&&(
                  <div style={{display:'flex',gap:'8px'}}>
                    <input type="time" value={form.startTime||'09:00'} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))} style={{flex:1,border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}}/>
                    <input type="time" value={form.endTime||'10:00'} onChange={e=>setForm(f=>({...f,endTime:e.target.value}))} style={{flex:1,border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}}/>
                  </div>
                )}
              </div>
              {/* 循环类型 */}
              <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'8px',fontWeight:600}}>循环类型</div>
                <div style={{display:'flex',borderRadius:'8px',overflow:'hidden',border:'1px solid #e2e8f0'}}>
                  {(['weekly','monthly'] as const).map(r=>(
                    <button key={r} onClick={()=>setForm(f=>({...f,repeat:r}))}
                      style={{flex:1,padding:'10px',border:'none',fontSize:'13px',cursor:'pointer',fontWeight:500,fontFamily:'inherit',
                        background:form.repeat===r?'#2563eb':'#fff',color:form.repeat===r?'#fff':'#475569'}}>
                      {r==='weekly'?'按星期':'按月'}
                    </button>
                  ))}
                </div>
              </div>
              {/* 重复星期 */}
              {form.repeat==='weekly'&&(
                <div><div style={{fontSize:'12px',color:'#64748b',marginBottom:'8px',fontWeight:600}}>重复星期</div>
                  <div style={{display:'flex',gap:'6px'}}>
                    {DAYS.map((d,i)=>(
                      <button key={i} onClick={()=>setForm(f=>({...f,repeatDays:(f.repeatDays||[]).includes(i)?f.repeatDays!.filter(x=>x!==i):[...(f.repeatDays||[]),i]}))}
                        style={{flex:1,padding:'8px 4px',border:'1px solid #e2e8f0',borderRadius:'6px',fontSize:'11px',cursor:'pointer',fontFamily:'inherit',
                          background:(form.repeatDays||[]).includes(i)?'#2563eb':'#fff',
                          color:(form.repeatDays||[]).includes(i)?'#fff':'#475569'}}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{padding:'10px 12px',background:'#f8fafc',borderRadius:'8px',fontSize:'11px',color:'#64748b',border:'1px solid #e2e8f0'}}>
                ℹ️ 提示：创建完之后，可以在待办计划中修改或删除；循环任务不关联长期任务。
              </div>
            </div>
            <div style={{padding:'16px 24px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'flex-end',gap:'10px'}}>
              <button onClick={()=>setShowRepeat(false)} style={{padding:'8px 18px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>取消</button>
              <button onClick={()=>{setForm(f=>({...f,repeat:form.repeat||'weekly'}));addItem()}}
                style={{padding:'8px 20px',borderRadius:'7px',border:'none',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
