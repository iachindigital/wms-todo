'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

const NAV = [
  { group: '工作台', items: [
    { href:'/warehouse/dashboard',      icon:'⊞', label:'仓库总览' },
    { href:'/warehouse/todos',          icon:'✓', label:'全部待办' },
    { href:'/warehouse/planner',        icon:'⊡', label:'待办计划' },
    { href:'/warehouse/schedule',       icon:'📅', label:'日程安排' },
  ]},
  { group: '任务协作', items: [
    { href:'/warehouse/tasks/internal',    icon:'📋', label:'内部任务' },
    { href:'/warehouse/tasks/subordinate', icon:'📤', label:'下级任务' },
    { href:'/warehouse/tasks/public',      icon:'🌐', label:'公开任务' },
    { href:'/warehouse/tasks/longterm',    icon:'📌', label:'长期任务' },
  ]},
  { group: '打单系统', items: [
    { href:'/warehouse/daily-dispatch', icon:'📋', label:'每日代发详情' },
    { href:'/warehouse/jt-orders',      icon:'🚚', label:'极兔订单管理' },
    { href:'/warehouse/jt-settings',    icon:'⚙',  label:'极兔系统设置' },
    { href:'/warehouse/shipping',       icon:'📦', label:'发货记录' },
  ]},
  { group: '管理', items: [
    { href:'/warehouse/clients',   icon:'⊙', label:'客户管理' },
    { href:'/warehouse/accounts',  icon:'👤', label:'客户账号' },
    { href:'/warehouse/staff',     icon:'⊛', label:'员工管理' },
  ]},
  { group: '领星数据', items: [
    { href:'/warehouse/sync',      icon:'↻', label:'数据同步' },
    { href:'/warehouse/oms-data',  icon:'◈', label:'数据总览' },
  ]},
  { group: '库内管理', items: [
    { href:'/warehouse/inventory/products',  icon:'📦', label:'产品库存' },
    { href:'/warehouse/inventory/boxes',     icon:'📫', label:'箱库存' },
    { href:'/warehouse/inventory/returns',   icon:'↩️', label:'退货库存' },
    { href:'/warehouse/inventory/stocktake', icon:'🔍', label:'盘点' },
    { href:'/warehouse/inventory/locations', icon:'📍', label:'库位管理' },
  ]},
  { group: '系统', items: [
    { href:'/warehouse/settings',  icon:'⚙', label:'系统设置' },
  ]},
]

// 双城时钟组件
function DualClock() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const fmt = (tz: string) => {
    try {
      return new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' })
    } catch(e) { return '' }
  }
  return (
    <div style={{display:'flex',gap:'16px',alignItems:'center'}}>
      <div style={{textAlign:'right' as const}}>
        <div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'1px'}}>🇲🇽 墨西哥城</div>
        <div style={{fontSize:'14px',fontWeight:700,color:'#ffffff',fontVariantNumeric:'tabular-nums',fontFamily:'monospace'}}>{fmt('America/Mexico_City')}</div>
      </div>
      <div style={{width:'1px',height:'28px',background:'#334155'}}/>
      <div style={{textAlign:'right' as const}}>
        <div style={{fontSize:'10px',color:'#94a3b8',marginBottom:'1px'}}>🇨🇳 北京</div>
        <div style={{fontSize:'14px',fontWeight:700,color:'#ffffff',fontVariantNumeric:'tabular-nums',fontFamily:'monospace'}}>{fmt('Asia/Shanghai')}</div>
      </div>
    </div>
  )
}

// Tab bar - tracks open pages
const MAX_TABS = 10

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const path   = usePathname()
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [tabs, setTabs] = useState<{href:string;label:string}[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Build label map from NAV
  const labelMap: Record<string,string> = {}
  NAV.forEach(g => g.items.forEach(item => { labelMap[item.href] = item.label }))

  useEffect(() => {
    if(typeof window!=='undefined') sessionStorage.setItem('wms_warehouse_role','admin')
    // 通过 /api/auth-check 验证 PocketBase cookie token
    fetch('/api/auth-check').then(r => {
      if (!r.ok) router.push('/auth/login')
      else setAuthChecked(true)
    }).catch(() => router.push('/auth/login'))
  }, [router])

  // Add tab when path changes
  useEffect(() => {
    if(!path || path === '/warehouse') return
    const label = labelMap[path] || path.split('/').pop() || path
    setTabs(prev => {
      if(prev.find(t => t.href === path)) return prev
      const next = [...prev, {href:path, label}]
      return next.slice(-MAX_TABS)
    })
  }, [path]) // eslint-disable-line

  const closeTab = (e: React.MouseEvent, href: string) => {
    e.preventDefault(); e.stopPropagation()
    setTabs(prev => {
      const next = prev.filter(t => t.href !== href)
      if(path === href && next.length > 0) router.push(next[next.length-1].href)
      else if(next.length === 0) router.push('/warehouse/dashboard')
      return next
    })
  }

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' })
    router.push('/auth/login')
  }

  if (!authChecked) return (
    <div style={{minHeight:'100vh',background:'#f8fafc',display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8',fontSize:'14px'}}>加载中...</div>
  )

  return (
    <div style={{display:'flex',height:'100vh',background:'#f0f4f8',color:'#0f172a',fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif",flexDirection:'column'}}>

      {/* ── 顶部标签栏 ── */}
      <div style={{background:'#1e293b',borderBottom:'1px solid #334155',flexShrink:0,display:'flex',alignItems:'stretch',minHeight:'42px'}}>
        {/* Logo区 */}
        <Link href="/warehouse/dashboard" style={{display:'flex',alignItems:'center',gap:'8px',padding:'0 16px',textDecoration:'none',borderRight:'1px solid #334155',flexShrink:0}}>
          <span style={{fontSize:'16px'}}>🏭</span>
          <span style={{fontSize:'13px',fontWeight:700,color:'#f1f5f9',whiteSpace:'nowrap'}}>海外仓 WMS</span>
        </Link>
        {/* 标签页 */}
        <div style={{display:'flex',alignItems:'stretch',flex:1,overflowX:'auto',overflowY:'hidden'}}>
          {tabs.map(tab => {
            const active = path === tab.href
            return (
              <div key={tab.href} style={{display:'flex',alignItems:'center',gap:'6px',padding:'0 14px',
                borderRight:'1px solid #334155',cursor:'pointer',flexShrink:0,minWidth:'80px',maxWidth:'160px',
                background:active?'#fff':'transparent',
                borderTop:active?'2px solid #3b82f6':'2px solid transparent',
                transition:'background 0.15s'}}
                onClick={()=>router.push(tab.href)}>
                <span style={{fontSize:'12px',color:active?'#1e293b':'#94a3b8',fontWeight:active?600:400,
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{tab.label}</span>
                <span onClick={e=>closeTab(e,tab.href)}
                  style={{color:'#64748b',fontSize:'14px',lineHeight:1,flexShrink:0,padding:'2px',
                    borderRadius:'3px',cursor:'pointer'}}
                  onMouseEnter={e=>(e.currentTarget.style.color='#ef4444')}
                  onMouseLeave={e=>(e.currentTarget.style.color='#64748b')}>×</span>
              </div>
            )
          })}
        </div>
        {/* 右侧操作 */}
        <div style={{display:'flex',alignItems:'center',gap:'16px',padding:'0 16px',borderLeft:'1px solid #334155',flexShrink:0}}>
          <DualClock />
          <button onClick={handleLogout}
            style={{padding:'6px 14px',borderRadius:'5px',background:'#334155',border:'none',color:'#ffffff',fontSize:'12px',fontWeight:600,cursor:'pointer',transition:'background 0.2s'}}
            onMouseEnter={e=>(e.currentTarget.style.background='#475569')}
            onMouseLeave={e=>(e.currentTarget.style.background='#334155')}>
            退出
          </button>
        </div>
      </div>

      {/* ── 主体区域 ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* 侧边栏 */}
        <div style={{width:sidebarCollapsed?'48px':'192px',flexShrink:0,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',overflowY:'auto',transition:'width 0.2s'}}>
          {/* 折叠按钮 */}
          <div style={{padding:'8px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:sidebarCollapsed?'center':'flex-end'}}>
            <button onClick={()=>setSidebarCollapsed(v=>!v)}
              style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'16px',padding:'4px',borderRadius:'4px'}}
              title={sidebarCollapsed?'展开':'收起'}>
              {sidebarCollapsed?'›':'‹'}
            </button>
          </div>
          <nav style={{flex:1,padding:'6px'}}>
            {NAV.map(g=>(
              <div key={g.group} style={{marginBottom:'2px'}}>
                {!sidebarCollapsed && (
                  <div style={{fontSize:'10px',color:'#94a3b8',fontWeight:600,padding:'6px 8px 2px',letterSpacing:'0.06em',textTransform:'uppercase'}}>{g.group}</div>
                )}
                {g.items.map(item=>{
                  const active = path===item.href||(item.href.length>20&&path.startsWith(item.href))
                  return (
                    <Link key={item.href+item.label} href={item.href} title={sidebarCollapsed?item.label:''} style={{
                      display:'flex',alignItems:'center',gap:'8px',
                      padding:sidebarCollapsed?'8px':'7px 10px',
                      borderRadius:'6px',marginBottom:'1px',textDecoration:'none',
                      justifyContent:sidebarCollapsed?'center':'flex-start',
                      background:active?'#eff6ff':'transparent',
                      color:active?'#2563eb':'#475569',
                      fontSize:'13px',fontWeight:active?600:400,
                    }}>
                      <span style={{fontSize:'14px',width:'16px',textAlign:'center',flexShrink:0}}>{item.icon}</span>
                      {!sidebarCollapsed && <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{item.label}</span>}
                      {!sidebarCollapsed && active && <span style={{marginLeft:'auto',width:'4px',height:'4px',borderRadius:'50%',background:'#2563eb',flexShrink:0}}/>}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* 内容区 */}
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          {children}
        </div>
      </div>
    </div>
  )
}
