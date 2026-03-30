'use client'
import { useState, useEffect } from 'react'

interface LongTask {
  id: string; title: string; biz_type: string; task_type: string
  collaborators: string[]; end_date: string|null; created_at: string; status: 'active'|'done'
}

const BIZ_TYPES = ['工作计划', '项目管理', '客户跟进', '产品开发', '市场推广', '其他']
const TASK_TYPES = ['个人', '团队', '跨部门', '全公司']

export default function LongTermTaskPage() {
  const [tasks,   setTasks]   = useState<LongTask[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [show,    setShow]    = useState(false)
  const [form,    setForm]    = useState<Partial<LongTask>>({ collaborators: [] })
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    fetch('/api/long-term-tasks')
      .then(r => r.json())
      .then(d => { setTasks(d.tasks ?? []); setLoading(false) })
  }, [])

  const add = async () => {
    if (!form.title?.trim() || !form.biz_type || !form.task_type || saving) return
    setSaving(true)
    try {
      const r = await fetch('/api/long-term-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          biz_type: form.biz_type,
          task_type: form.task_type,
          collaborators: form.collaborators || [],
          end_date: form.end_date || null,
        }),
      })
      const d = await r.json()
      if (d.task) {
        setTasks(prev => [d.task, ...prev])
        setForm({ collaborators: [] })
        setShow(false)
      }
    } finally { setSaving(false) }
  }

  const markDone = async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done' } : t))
    await fetch('/api/long-term-tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'done' }),
    })
  }

  const remove = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/long-term-tasks?id=${id}`, { method: 'DELETE' })
  }

  const filtered = tasks.filter(t => !search || (t.title || '').includes(search))
  const inp: React.CSSProperties = { display: 'block', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', marginTop: '6px', boxSizing: 'border-box', fontFamily: 'inherit', cursor: 'pointer', background: '#fff' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>📌 长期任务</h1>
          <span style={{ padding: '1px 8px', borderRadius: '20px', background: '#f0fdf4', color: '#16a34a', fontSize: '11px', fontWeight: 600, border: '1px solid #bbf7d0' }}>
            {tasks.filter(t => t.status === 'active').length} 进行中
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索任务..."
            style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={() => setShow(true)}
            style={{ padding: '7px 16px', borderRadius: '7px', background: '#22c55e', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>＋ 新建</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>加载中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            {search ? '没有匹配的任务' : '暂无长期任务，数据已云端同步，新建后多浏览器均可查看'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '14px' }}>
            {filtered.map(t => (
              <div key={t.id} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0, flex: 1 }}>{t.title}</h3>
                  <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, background: t.status === 'done' ? '#f0fdf4' : '#f0f9ff', color: t.status === 'done' ? '#16a34a' : '#0284c7', flexShrink: 0 }}>
                    {t.status === 'done' ? '已完成' : '进行中'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '1px 7px', borderRadius: '4px', background: '#eff6ff', color: '#2563eb', fontSize: '11px' }}>{t.biz_type}</span>
                  <span style={{ padding: '1px 7px', borderRadius: '4px', background: '#f0fdf4', color: '#16a34a', fontSize: '11px' }}>{t.task_type}</span>
                </div>
                {t.end_date && <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>截止：{t.end_date}</div>}
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
                  {new Date(t.created_at).toLocaleDateString('zh-CN')} 创建
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {t.status === 'active' && (
                    <button onClick={() => markDone(t.id)}
                      style={{ flex: 1, padding: '6px', borderRadius: '5px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>完成</button>
                  )}
                  <button onClick={() => remove(t.id)}
                    style={{ flex: 1, padding: '6px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' }}>删除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShow(false) }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '500px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>新建长期任务</span>
              <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#94a3b8', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>任务标题 *</span>
                <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="请输入标题"
                  style={{ display: 'block', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', marginTop: '6px', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>业务类型 *</span>
                <select value={form.biz_type || ''} onChange={e => setForm(f => ({ ...f, biz_type: e.target.value }))} style={inp}>
                  <option value="">请选择</option>
                  {BIZ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>任务类型 *</span>
                <select value={form.task_type || ''} onChange={e => setForm(f => ({ ...f, task_type: e.target.value }))} style={inp}>
                  <option value="">请选择</option>
                  {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>结束日期</span>
                <input type="date" value={form.end_date || ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={{ ...inp, cursor: 'default' }} />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={add} disabled={saving}
                style={{ padding: '9px 28px', borderRadius: '7px', border: 'none', background: saving ? '#94a3b8' : '#22c55e', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? '提交中...' : '✓ 提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
