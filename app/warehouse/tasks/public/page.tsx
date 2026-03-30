'use client'
import { useState, useEffect } from 'react'
interface PublicTask { id:string; title:string; deadline:string; content:string; priority:'一般'|'加急'; createdAt:string; status:'pending'|'done' }
const gid=()=>Math.random().toString(36).slice(2)
export default function PublicTaskPage() {
  const [tasks,setTasks]=useState<PublicTask[]>([])
  const [show,setShow]=useState(false)
  const [form,setForm]=useState<Partial<PublicTask>>({priority:'一般'})
  useEffect(()=>{try{const s=localStorage.getItem('wms-tasks-public');if(s)setTasks(JSON.parse(s))}catch{};},[])
  const save=(n:PublicTask[])=>{setTasks(n);try{localStorage.setItem('wms-tasks-public',JSON.stringify(n))}catch{}}
  const add=()=>{if(!form.title?.trim())return;save([{id:gid(),title:form.title.trim(),deadline:form.deadline||'',content:form.content||'',priority:form.priority||'一般',createdAt:new Date().toISOString(),status:'pending'},...tasks]);setForm({priority:'一般'});setShow(false)}
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#f8fafc'}}>
      <div style={{padding:'14px 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}><h1 style={{fontSize:'16px',fontWeight:700,color:'#0f172a'}}>🌐 公开任务</h1></div>
        <button onClick={()=>setShow(true)} style={{padding:'7px 16px',borderRadius:'7px',background:'#2563eb',border:'none',color:'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>＋ 新建</button>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        <div style={{background:'#fff',borderRadius:'10px',border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
            <thead><tr style={{background:'#f8fafc'}}>{['#','标题','时限','优先级','状态','操作'].map(h=><th key={h} style={{padding:'10px 14px',fontWeight:600,color:'#64748b',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',fontSize:'11px'}}>{h}</th>)}</tr></thead>
            <tbody>
              {tasks.length===0?<tr><td colSpan={6} style={{padding:'40px',textAlign:'center' as const,color:'#94a3b8'}}>暂无公开任务</td></tr>
              :tasks.map((t,i)=><tr key={t.id} style={{borderBottom:'1px solid #f8fafc',background:i%2===0?'#fff':'#fafbfc'}}>
                <td style={{padding:'10px 14px',color:'#94a3b8',fontSize:'11px'}}>{i+1}</td>
                <td style={{padding:'10px 14px',fontWeight:500}}>{t.title}</td>
                <td style={{padding:'10px 14px',color:'#64748b',fontSize:'12px'}}>{t.deadline||'-'}</td>
                <td style={{padding:'10px 14px'}}><span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:t.priority==='加急'?'#fef2f2':'#eff6ff',color:t.priority==='加急'?'#dc2626':'#2563eb'}}>{t.priority}</span></td>
                <td style={{padding:'10px 14px'}}><span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:t.status==='done'?'#f0fdf4':'#fffbeb',color:t.status==='done'?'#16a34a':'#d97706'}}>{t.status==='done'?'已完成':'待处理'}</span></td>
                <td style={{padding:'10px 14px'}}><button onClick={()=>save(tasks.filter(x=>x.id!==t.id))} style={{fontSize:'11px',color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>删除</button></td>
              </tr>)}
            </tbody>
          </table>
          <div style={{padding:'10px 14px',fontSize:'12px',color:'#94a3b8',borderTop:'1px solid #f1f5f9'}}>共 {tasks.length} 条</div>
        </div>
      </div>
      {show&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setShow(false)}}>
        <div style={{background:'#fff',borderRadius:'12px',width:'520px',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:'16px',fontWeight:700}}>新建公开任务</span><button onClick={()=>setShow(false)} style={{background:'none',border:'none',fontSize:'22px',color:'#94a3b8',cursor:'pointer'}}>×</button></div>
          <div style={{padding:'20px 24px',display:'flex',flexDirection:'column' as const,gap:'14px'}}>
            <div><span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>标题</span><input value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="必填" style={{display:'block',width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',outline:'none',marginTop:'4px',boxSizing:'border-box' as const,fontFamily:'inherit'}}/></div>
            <div><span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>截止日期</span><input type="date" value={form.deadline||''} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={{display:'block',width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',outline:'none',marginTop:'4px',boxSizing:'border-box' as const}}/></div>
            <div><span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>内容</span><textarea value={form.content||''} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={4} style={{display:'block',width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',outline:'none',marginTop:'4px',resize:'vertical' as const,fontFamily:'inherit',boxSizing:'border-box' as const}}/></div>
            <div style={{display:'flex',gap:'12px',alignItems:'center'}}><span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>优先级</span>{(['一般','加急'] as const).map(v=><label key={v} style={{display:'flex',alignItems:'center',gap:'4px',cursor:'pointer'}}><input type="radio" name="ppri" checked={form.priority===v} onChange={()=>setForm(f=>({...f,priority:v}))} style={{accentColor:'#2563eb'}}/><span style={{fontSize:'12px'}}>{v}</span></label>)}</div>
          </div>
          <div style={{padding:'14px 24px',borderTop:'1px solid #f1f5f9',display:'flex',justifyContent:'flex-end',gap:'10px'}}>
            <button onClick={()=>setShow(false)} style={{padding:'8px 18px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>取消</button>
            <button onClick={add} style={{padding:'8px 20px',borderRadius:'7px',border:'none',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>提交</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
