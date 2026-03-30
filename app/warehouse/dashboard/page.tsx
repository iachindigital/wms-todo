'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface Todo { id:string; title:string; category:string; status:number; priority:number; description:string|null; due_date:string|null; customer_code:string|null }
interface InternalTask { id:string; title:string; status:string; priority:string; created_at:string }
interface StickyNote { id:string; text:string; color:string; pos_x:number; pos_y:number }
interface NewTodoForm { text:string; type:string; priority:string }

const NOTE_COLORS = ['#fef9c3','#dcfce7','#dbeafe','#fce7f3','#ede9fe','#ffedd5']
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

export default function WarehouseDashboard() {
  const [todos,        setTodos]        = useState<Todo[]>([])
  const [loading,      setLoading]      = useState(true)
  const [workTodos,    setWorkTodos]    = useState<InternalTask[]>([])
  const [workLoading,  setWorkLoading]  = useState(true)
  const [notes,        setNotes]        = useState<StickyNote[]>([])
  const [showNewTodo,  setShowNewTodo]  = useState(false)
  const [newForm,      setNewForm]      = useState<NewTodoForm>({text:'',type:'工作',priority:'medium'})
  const [savingTodo,   setSavingTodo]   = useState(false)
  
  const [activeNote,   setActiveNote]   = useState<string|null>(null)

  // bulletproof drag: everything in refs, no stale closures
  const dragInfo    = useRef<{id:string, startX:number, startY:number, origX:number, origY:number}|null>(null)
  const notesRef    = useRef(notes)
  useEffect(() => { notesRef.current = notes }, [notes])

  // 加载数据
  useEffect(() => {
    const t = Date.now()
    // 从领星同步的待办
    fetch(`/api/todos?pageSize=500&_t=${t}`).then(r => r.json()).then(d => {
      setTodos(d.todos ?? [])
      setLoading(false)
    })
    // 从内部任务加载 (展示在工作待办，过滤掉 clear/archived 状态的)
    fetch(`/api/internal-tasks?_t=${t}`).then(r => r.json()).then(d => {
      setWorkTodos((d.tasks ?? []).filter((t: any) => t.status !== 'cleared'))
      setWorkLoading(false)
    })
    // 从数据库加载便签
    fetch(`/api/sticky-notes?_t=${t}`).then(r => r.json()).then(d => {
      setNotes(d.notes ?? [])
    })
  }, [])

  // 工作待办操作 (映射为 Internal Tasks)
  const addWorkTodo = async () => {
    if (!newForm.text.trim() || savingTodo) return
    setSavingTodo(true)
    try {
      const r = await fetch('/api/internal-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newForm.text.trim(), 
          priority: newForm.priority === 'high' ? '加急' : '一般', 
          type: '任务', 
          source: '工作台',
          tenant_id: DEFAULT_TENANT 
        }),
      })
      const d = await r.json()
      if (d.task) {
        setWorkTodos(prev => [d.task, ...prev])
        setNewForm({ text: '', type: '工作', priority: 'medium' })
        setShowNewTodo(false)
      }
    } finally { setSavingTodo(false) }
  }

  const toggleTodo = async (id: string, done: boolean) => {
    const newStatus = done ? 'done' : 'pending'
    setWorkTodos(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    await fetch('/api/internal-tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    })
  }

  const deleteTodo = async (id: string) => {
    setWorkTodos(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/internal-tasks?id=${id}`, { method: 'DELETE' })
  }

  const clearDone = async () => {
    const done = workTodos.filter(t => t.status === 'done')
    setWorkTodos(prev => prev.filter(t => t.status !== 'done'))
    await Promise.all(done.map(t => fetch('/api/internal-tasks', { 
      method: 'PATCH', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ id: t.id, status: 'cleared' })
    })))
  }

  // 便签操作
  const addNote = async () => {
    const r = await fetch('/api/sticky-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
        pos_x: 200 + Math.random() * 100,
        pos_y: 200 + Math.random() * 100,
        tenant_id: DEFAULT_TENANT,
      }),
    })
    const d = await r.json()
    if (d.note) { setNotes(prev => [...prev, d.note]); setActiveNote(d.note.id) }
  }

  const updateNote = useCallback(async (id: string, text: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n))
    await fetch('/api/sticky-notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, text }),
    })
  }, [])

  const updateNoteColor = async (id: string, color: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, color } : n))
    await fetch('/api/sticky-notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, color }),
    })
  }

  const updateNotePos = useCallback(async (id: string, pos_x: number, pos_y: number) => {
    await fetch('/api/sticky-notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pos_x, pos_y }),
    })
  }, [])

  const deleteNote = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
    if (activeNote === id) setActiveNote(null)
    await fetch(`/api/sticky-notes?id=${id}`, { method: 'DELETE' })
  }

  // 拖动便签 - fully ref-based, zero stale closure, Pointer Events for Touch
  const onNotePointerDown = (e: React.PointerEvent, id: string) => {
    const target = e.target as HTMLElement
    // 忽略文本框点击和按钮（避免关不掉的情况）
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('button')) return
    
    // 如果点击的是改变颜色的圆圈，也不要触发拖动
    if (target.style.borderRadius === '50%') return

    const note = notesRef.current.find(n => n.id === id); if (!note) return
    setActiveNote(id)
    dragInfo.current = { id, startX: e.clientX, startY: e.clientY, origX: note.pos_x, origY: note.pos_y }
  }

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const d = dragInfo.current; if (!d) return
      // 使用 clientX/Y 直接匹配 fixed 也是按 viewport 定位的
      const newX = d.origX + (e.clientX - d.startX)
      const newY = d.origY + (e.clientY - d.startY)
      notesRef.current = notesRef.current.map(n => n.id === d.id ? { ...n, pos_x: newX, pos_y: newY } : n)
      setNotes(notesRef.current)
    }
    const handleUp = (e: PointerEvent) => {
      if (dragInfo.current) {
        const note = notesRef.current.find(n => n.id === dragInfo.current!.id)
        if (note) updateNotePos(note.id, note.pos_x, note.pos_y)
        dragInfo.current = null
      }
    }
    
    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
    return () => { 
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }
  }, [updateNotePos])

  // 统计
  const byCategory = (cat: string, statuses?: number[]) => { const f = todos.filter(t => t.category === cat); return statuses ? f.filter(t => statuses.includes(t.status)) : f }
  const outboundPending = byCategory('出库作业', [0]).length
  const inboundPending  = byCategory('入库作业', [0]).length
  const returnsPending  = byCategory('退货处理', [0]).length
  const invPending      = byCategory('库存管理', [0]).length
  const workTodoPending = workTodos.filter(t => t.status === 'pending').length

  const STAT_CARDS = [
    { label: '待办事项', value: workTodoPending, color: '#dc2626', bg: '#fef2f2', icon: '☑', href: null },
    { label: '长期任务', value: 0, color: '#16a34a', bg: '#f0fdf4', icon: '📌', href: '/warehouse/tasks/longterm' },
    { label: '工作看板', value: 0, color: '#d97706', bg: '#fffbeb', icon: '⊞', href: '/warehouse/planner' },
    { label: '待出库', value: outboundPending, color: '#2563eb', bg: '#eff6ff', icon: '📦', href: '/warehouse/outbound' },
  ]

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
  const PRIORITY_COLORS: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#16a34a' }
  const PRIORITY_LABELS: Record<string, string> = { high: '紧急', medium: '普通', low: '低优' }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '24px 28px', position: 'relative' }}>
      {/* 标题栏 */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>仓库总览</h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        {/* 右上角操作按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowNewTodo(true)}
              style={{ padding: '7px 14px', borderRadius: '7px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              ＋ 新建待办
            </button>
            <button onClick={addNote}
              style={{ padding: '7px 14px', borderRadius: '7px', background: '#f59e0b', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              📝 新建便签
            </button>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        {STAT_CARDS.map(s => (
          <div key={s.label} style={{ ...card, padding: '18px 20px', borderLeft: `4px solid ${s.color}`, cursor: s.href ? 'pointer' : 'default' }}
            onClick={() => s.href && (window.location.href = s.href)}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px' }}>{s.icon}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>详细信息 →</span>
            </div>
            <div style={{ fontSize: '36px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{loading ? '…' : s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '5px', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* 下方两栏 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* 待办事项列表 */}
        <div style={card}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>☑</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>待办事项</span>
              {workTodoPending > 0 && <span style={{ padding: '1px 7px', borderRadius: '20px', background: '#fef2f2', color: '#dc2626', fontSize: '11px', fontWeight: 700, border: '1px solid #fecaca' }}>{workTodoPending}</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setShowNewTodo(true)}
                style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#eff6ff', border: 'none', color: '#2563eb', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</button>
              <button onClick={addNote}
                style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#fffbeb', border: 'none', color: '#d97706', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📝</button>
            </div>
          </div>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {workLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>加载中...</div>
            ) : workTodos.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>暂无待办事项</div>
            ) : workTodos.map(t => (
              <div key={t.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: '10px', background: t.status === 'done' ? '#fafbfc' : '#fff' }}>
                <input type="checkbox" checked={t.status === 'done'} onChange={() => toggleTodo(t.id, t.status !== 'done')}
                  style={{ accentColor: '#2563eb', width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: t.status === 'done' ? '#94a3b8' : '#0f172a', textDecoration: t.status === 'done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                </div>
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: t.priority === '加急' ? '#fecaca' : '#bfdbfe', color: t.priority === '加急' ? '#dc2626' : '#2563eb', fontWeight: 600, flexShrink: 0 }}>
                  {t.priority}
                </span>
                <button onClick={() => deleteTodo(t.id)}
                  style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: '14px', padding: '2px', flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}>×</button>
              </div>
            ))}
          </div>
          {workTodos.filter(t => t.status === 'done').length > 0 && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={clearDone} style={{ fontSize: '11px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>
                清除已完成 ({workTodos.filter(t => t.status === 'done').length})
              </button>
            </div>
          )}
        </div>

        {/* 业务数据快览 */}
        <div style={card}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>📊 业务待处理</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: '一件代发待出库', value: outboundPending, color: '#2563eb', href: '/warehouse/outbound' },
              { label: '入库单待处理', value: inboundPending, color: '#7c3aed', href: '/warehouse/todos' },
              { label: '退件待处理', value: returnsPending, color: '#d97706', href: '/warehouse/todos' },
              { label: '库存预警', value: invPending, color: '#dc2626', href: '/warehouse/todos' },
            ].map(item => (
              <Link key={item.label} href={item.href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #f1f5f9', textDecoration: 'none' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>{item.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '22px', fontWeight: 800, color: item.color }}>{loading ? '…' : item.value}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 快速导航 */}
      <div style={card}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>⚡ 快速入口</span>
        </div>
        <div style={{ padding: '14px 16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { href: '/warehouse/planner', label: '待办计划' },
            { href: '/warehouse/schedule', label: '日程安排' },
            { href: '/warehouse/tasks/internal', label: '内部任务' },
            { href: '/warehouse/tasks/subordinate', label: '下级任务' },
            { href: '/warehouse/tasks/longterm', label: '长期任务' },
            { href: '/warehouse/daily-dispatch', label: '每日代发' },
            { href: '/warehouse/outbound', label: '出库明细' },
            { href: '/warehouse/sync', label: '数据同步' },
            { href: '/warehouse/jt-orders', label: '极兔订单' },
            { href: '/warehouse/inventory/products', label: '产品库存' },
            { href: '/warehouse/inventory/locations', label: '库位管理' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              style={{ padding: '7px 14px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', textDecoration: 'none', fontWeight: 500 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; (e.currentTarget as HTMLElement).style.color = '#2563eb' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.color = '#475569' }}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── 新建待办弹窗 ── */}
      {showNewTodo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewTodo(false) }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>新建待办</span>
              <button onClick={() => setShowNewTodo(false)} style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <textarea value={newForm.text} onChange={e => setNewForm({ ...newForm, text: e.target.value })}
                placeholder="请输入待办内容..."
                rows={4}
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', fontSize: '13px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <select value={newForm.priority} onChange={e => setNewForm({ ...newForm, priority: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fff', cursor: 'pointer' }}>
                <option value="high">🔴 紧急</option>
                <option value="medium">🟡 普通</option>
                <option value="low">🟢 低优先</option>
              </select>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowNewTodo(false)}
                style={{ padding: '8px 18px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: '13px', cursor: 'pointer' }}>关闭</button>
              <button onClick={addWorkTodo} disabled={savingTodo}
                style={{ padding: '8px 20px', borderRadius: '7px', border: 'none', background: savingTodo ? '#94a3b8' : '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: savingTodo ? 'not-allowed' : 'pointer' }}>
                {savingTodo ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 便签（可拖动）── */}
      {notes.map(note => (
        <div key={note.id}
          style={{ position: 'fixed', left: note.pos_x, top: note.pos_y, width: 200, zIndex: activeNote === note.id ? 500 : 400, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', borderRadius: '8px', overflow: 'hidden', cursor: 'default', userSelect: 'none', touchAction: 'none' }}
          draggable={false} onDragStart={e => e.preventDefault()}
          onClick={() => setActiveNote(note.id)}>
          <div style={{ background: note.color, padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'move', borderBottom: '1px solid rgba(0,0,0,0.08)', touchAction: 'none' }}
            onPointerDown={e => onNotePointerDown(e, note.id)}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#78350f' }}>📝 便签</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              {NOTE_COLORS.map(c => (
                <div key={c} onClick={e => { e.stopPropagation(); updateNoteColor(note.id, c) }}
                  style={{ width: '12px', height: '12px', borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.15)', cursor: 'pointer' }} />
              ))}
              <button onClick={() => deleteNote(note.id)}
                style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: '14px', padding: '0 2px', marginLeft: '4px' }}>×</button>
            </div>
          </div>
          <textarea value={note.text} onChange={e => updateNote(note.id, e.target.value)}
            placeholder="在这里输入内容..."
            style={{ width: '100%', height: 160, border: 'none', background: note.color, padding: '10px', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', display: 'block', color: '#292524' }} />
        </div>
      ))}
    </div>
  )
}
