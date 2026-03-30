'use client'
import { useState, useEffect } from 'react'
interface SubTask { id:string; title:string; type:string; deadline:string; content:string; notifyTo:string[]; priority:'一般'|'加急'; forceAttach:boolean; createdAt:string; status:'pending'|'done' }
const gid=()=>Math.random().toString(36).slice(2)
export default function SubordinateTaskPage() {
  const [tasks,setTasks]=useState<SubTask[]>([])
  const [show,setShow]=useState(false)
  const [form,setForm]=useState<Partial<SubTask>>({priority:'一般',notifyTo:[],forceAttach:false})
  useEffect(()=>{try{const s=localStorage.getItem('wms-tasks-sub');if(s)setTasks(JSON.parse(s))}catch{};},[])
  const save=(n:SubTask[])=>{setTasks(n);try{localStorage.setItem('wms-tasks-sub',JSON.stringify(n))}catch{}}
  const add=()=>{if(!form.title?.trim()||!form.deadline)return;save([{id:gid(),title:form.title.trim(),type:form.type||'',deadline:form.deadline,content:form.content||'',notifyTo:form.notifyTo||[],priority:form.priority||'一般',forceAttach:form.forceAttach||false,createdAt:new Date().toISOString(),status:'pending'},...tasks]);setForm({priority:'一般',notifyTo:[],forceAttach:false});setShow(false)}
  const inp:React.CSSProperties={display:'block',width:'100%',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'10px 12px',fontSize:'13px',outline:'none',marginTop:'4px',boxSizing:'border-box' as const,fontFamily:'inherit'}
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#f8fafc'}}>
      <div style={{padding:'14px 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px'}}><h1 style={{fontSize:'16px',fontWeight:700,color:'#0f172a'}}>📤 下级任务</h1><span style={{padding:'1px 8px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'11px',fontWeight:600,border:'1px solid #bfdbfe'}}>{tasks.filter(t=>t.status==='pending').length} 待处理</span></div>
        <div style={{display:'flex',gap:'8px'}}>{['自己','全部'].map(t=><button key={t} style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #e2e8f0',fontSize:'12px',cursor:'pointer',background:t==='自己'?'#2563eb':'#f8fafc',color:t==='自己'?'#fff':'#475569',fontFamily:'inherit'}}>{t}</button>)}<button onClick={()=>setShow(true)} style={{padding:'7px 16px',borderRadius:'7px',background:'#2563eb',border:'none',color:'#fff',fontSize:'12px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>＋ 新建</button></div>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        <div style={{background:'#fff',borderRadius:'10px',border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
            <thead><tr style={{background:'#f8fafc'}}>{['#','标题','类型','时限','通知对象','优先级','状态','操作'].map(h=><th key={h} style={{padding:'10px 14px',fontWeight:600,color:'#64748b',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',fontSize:'11px'}}>{h}</th>)}</tr></thead>
            <tbody>
              {tasks.length===0?<tr><td colSpan={8} style={{padding:'40px',textAlign:'center' as const,color:'#94a3b8'}}>暂无下级任务</td></tr>
              :tasks.map((t,i)=><tr key={t.id} style={{borderBottom:'1px solid #f8fafc',background:i%2===0?'#fff':'#fafbfc'}}>
                <td style={{padding:'10px 14px',color:'#94a3b8',fontSize:'11px'}}>{i+1}</td>
                <td style={{padding:'10px 14px',fontWeight:500,maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{t.title}</td>
                <td style={{padding:'10px 14px',color:'#64748b',fontSize:'12px'}}>{t.type||'-'}</td>
                <td style={{padding:'10px 14px',color:'#64748b',fontSize:'12px'}}>{t.deadline}</td>
                <td style={{padding:'10px 14px',color:'#64748b',fontSize:'12px'}}>{t.notifyTo.join(',')||'-'}</td>
                <td style={{padding:'10px 14px'}}><span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:t.priority==='加急'?'#fef2f2':'#eff6ff',color:t.priority==='加急'?'#dc2626':'#2563eb'}}>{t.priority}</span></td>
                <td style={{padding:'10px 14px'}}><span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:t.status==='done'?'#f0fdf4':'#fffbeb',color:t.status==='done'?'#16a34a':'#d97706'}}>{t.status==='done'?'已完成':'待处理'}</span></td>
                <td style={{padding:'10px 14px'}}><div style={{display:'flex',gap:'8px'}}><button onClick={()=>save(tasks.map(x=>x.id===t.id?{...x,status:'done' as const}:x))} style={{fontSize:'11px',color:'#2563eb',background:'none',border:'none',cursor:'pointer'}}>完成</button><button onClick={()=>save(tasks.filter(x=>x.id!==t.id))} style={{fontSize:'11px',color:'#ef4444',background:'none',border:'none',cursor:'pointer'}}>删除</button></div></td>
              </tr>)}
            </tbody>
          </table>
          <div style={{padding:'10px 14px',fontSize:'12px',color:'#94a3b8',borderTop:'1px solid #f1f5f9'}}>共 {tasks.length} 条</div>
        </div>
      </div>
      {show&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={e=>{if(e.target===e.currentTarget)setShow(false)}}>
        <div style={{background:'#fff',borderRadius:'12px',width:'820px',maxHeight:'85vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}><span style={{fontSize:'16px',fontWeight:700}}>事项详情</span><button onClick={()=>setShow(false)} style={{background:'none',border:'none',fontSize:'22px',color:'#94a3b8',cursor:'pointer'}}>×</button></div>
          <div style={{display:'flex',gap:0}}>
            <div style={{flex:1,padding:'20px 24px',display:'flex',flexDirection:'column' as const,gap:'14px',borderRight:'1px solid #f1f5f9'}}>
              <div style={{display:'flex',gap:'12px'}}>
                <div style={{flex:2}}><span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>标题</span><input value={form.title||''} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="必填" style={inp}/></div>
                <div style={{flex:1}}><span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>类型</span><select value={form.type||''} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={{...inp,cursor:'pointer'}}><option value="">选择</option><option>工作</option><option>通知</option><option>任务</option></select></div>
              </div>
              <div style={{display:'flex',gap:'12px'}}>
                <div style={{flex:1}}><span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>时限</span><input type="date" value={form.deadline||''} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} style={inp}/></div>
                <div style={{width:'80px',flexShrink:0}}><span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>附件</span><button style={{display:'block',marginTop:'4px',width:'100%',padding:'10px',border:'1px solid #e2e8f0',borderRadius:'8px',background:'#f8fafc',cursor:'pointer',fontSize:'12px',fontFamily:'inherit'}}>上传</button></div>
              </div>
              <div>
                <span style={{fontSize:'12px',color:'#64748b',fontWeight:600}}>事项内容</span>
                <div style={{marginTop:'4px',border:'1px solid #e2e8f0',borderRadius:'8px',overflow:'hidden'}}>
                  <div style={{padding:'6px 10px',background:'#f8fafc',borderBottom:'1px solid #e2e8f0',display:'flex',gap:'4px'}}>{['B','I','U','对齐▾','18▾','T▾','段落▾','表格▾','S','A▾','✎','↩','↪','🖼','🔗','✕'].map(b=><button key={b} style={{padding:'2px 6px',border:'1px solid #e2e8f0',borderRadius:'3px',background:'#fff',cursor:'pointer',fontSize:'11px',fontFamily:'serif'}}>{b}</button>)}</div>
                  <textarea value={form.content||''} onChange={e=>setForm(f=>({...f,content:e.target.value}))} placeholder="详细事务内容请在此描述..." rows={6} style={{width:'100%',border:'none',padding:'12px',fontSize:'13px',resize:'vertical' as const,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
                </div>
              </div>
            </div>
            {/* 通知对象 */}
            <div style={{width:'220px',flexShrink:0,padding:'20px 16px',display:'flex',flexDirection:'column' as const,gap:'10px'}}>
              <span style={{fontSize:'13px',fontWeight:700,color:'#0f172a'}}>通知对象</span>
              <div style={{display:'flex',gap:'6px',fontSize:'12px'}}>
                <button style={{padding:'4px 10px',borderRadius:'5px',background:'#2563eb',color:'#fff',border:'none',cursor:'pointer',fontFamily:'inherit'}}>全部</button>
                <button style={{padding:'4px 10px',borderRadius:'5px',background:'#f8fafc',color:'#475569',border:'1px solid #e2e8f0',cursor:'pointer',fontFamily:'inherit'}}>办公室</button>
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                <div style={{flex:1,border:'1px solid #e2e8f0',borderRadius:'6px',padding:'6px',minHeight:'80px',fontSize:'12px',color:'#94a3b8'}}>没有可选项</div>
                <div style={{display:'flex',flexDirection:'column' as const,gap:'4px',justifyContent:'center'}}>
                  <button style={{padding:'4px 6px',border:'1px solid #e2e8f0',borderRadius:'4px',background:'#f8fafc',cursor:'pointer',fontSize:'11px',fontFamily:'inherit'}}>{'>>'}</button>
                  <button style={{padding:'4px 6px',border:'1px solid #e2e8f0',borderRadius:'4px',background:'#f8fafc',cursor:'pointer',fontSize:'11px',fontFamily:'inherit'}}>{'<<'}</button>
                </div>
                <div style={{flex:1,border:'1px solid #e2e8f0',borderRadius:'6px',padding:'6px',minHeight:'80px',fontSize:'12px',color:'#94a3b8'}}>没有可选项</div>
              </div>
            </div>
          </div>
          <div style={{padding:'14px 24px',borderTop:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',gap:'14px',alignItems:'center'}}>
              <button style={{padding:'5px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'11px',cursor:'pointer',fontFamily:'inherit'}}>📊 EXCEL</button>
              <button style={{padding:'5px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'11px',cursor:'pointer',fontFamily:'inherit'}}>⊞ 独立表格</button>
              {(['一般','加急'] as const).map(v=><label key={v} style={{display:'flex',alignItems:'center',gap:'4px',cursor:'pointer'}}><input type="radio" name="spri" checked={form.priority===v} onChange={()=>setForm(f=>({...f,priority:v}))} style={{accentColor:v==='加急'?'#dc2626':'#2563eb'}}/><span style={{fontSize:'12px',color:v==='加急'?'#dc2626':'#475569'}}>{v}</span></label>)}
              <label style={{display:'flex',alignItems:'center',gap:'4px',cursor:'pointer'}}><input type="checkbox" checked={form.forceAttach||false} onChange={e=>setForm(f=>({...f,forceAttach:e.target.checked}))} style={{accentColor:'#2563eb'}}/><span style={{fontSize:'12px',color:'#475569'}}>强制附件</span></label>
            </div>
            <button onClick={add} style={{padding:'9px 24px',borderRadius:'7px',border:'none',background:'#2563eb',color:'#fff',fontSize:'13px',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>✓ 提交</button>
          </div>
        </div>
      </div>}
    </div>
  )
}
