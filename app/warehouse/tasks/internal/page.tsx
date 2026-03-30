'use client'
import { useState, useEffect } from 'react'

interface Task {
  id: string; title: string; deadline: string|null; source: string; content: string
  opinion: string; type: '通知'|'任务'; priority: '一般'|'加急'; created_at: string; status: 'pending'|'done'
}

export default function InternalTaskPage() {
  const [tasks,   setTasks]   = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [show,    setShow]    = useState(false)
  const [form,    setForm]    = useState<Partial<Task>>({ type: '通知', priority: '一般' })

  useEffect(() => {
    fetch('/api/internal-tasks?_t=' + Date.now())
      .then(r => r.json())
      .then(d => { setTasks(d.tasks ?? []); setLoading(false) })
  }, [])

  const add = async () => {
    if (!form.title?.trim() || saving) return
    setSaving(true)
    try {
      const r = await fetch('/api/internal-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(), deadline: form.deadline || null,
          source: form.source || '', content: form.content || '',
          opinion: form.opinion || '', type: form.type || '通知',
          priority: form.priority || '一般',
        }),
      })
      const d = await r.json()
      if (d.task) {
        setTasks(prev => [d.task, ...prev])
        setForm({ type: '通知', priority: '一般' })
        setShow(false)
      }
    } finally { setSaving(false) }
  }

  const markDone = async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done' } : t))
    await fetch('/api/internal-tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'done' }),
    })
  }

  const remove = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/internal-tasks?id=${id}`, { method: 'DELETE' })
  }

  const inp: React.CSSProperties = { display: 'block', width: '100%', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', marginTop: '4px', boxSizing: 'border-box', fontFamily: 'inherit' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>📋 内部任务</h1>
          <span style={{ padding: '1px 8px', borderRadius: '20px', background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 600, border: '1px solid #bfdbfe' }}>
            {tasks.filter(t => t.status === 'pending').length} 待处理
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShow(true)} style={{ padding: '7px 16px', borderRadius: '7px', background: '#2563eb', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>＋ 新建</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['#', '标题', '时限', '来源', '类型', '优先级', '状态', '操作'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', fontWeight: 600, color: '#64748b', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>加载中...</td></tr>
              ) : tasks.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>暂无内部任务，点击「新建」创建</td></tr>
              ) : tasks.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                  <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '11px' }}>{i + 1}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>{t.deadline || '-'}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>{t.source || '-'}</td>
                  <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: '#f0f9ff', color: '#0284c7' }}>{t.type}</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: t.priority === '加急' ? '#fef2f2' : '#eff6ff', color: t.priority === '加急' ? '#dc2626' : '#2563eb' }}>{t.priority}</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: (t.status === 'done' || t.status === 'cleared') ? '#f0fdf4' : '#fffbeb', color: (t.status === 'done' || t.status === 'cleared') ? '#16a34a' : '#d97706' }}>{(t.status === 'done' || t.status === 'cleared') ? '已完成' : '待处理'}</span></td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {t.status === 'pending' && <button onClick={() => markDone(t.id)} style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>完成</button>}
                      <button onClick={() => remove(t.id)} style={{ fontSize: '11px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>删除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 14px', fontSize: '12px', color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>共 {tasks.length} 条 · 数据已同步到云端数据库</div>
        </div>
      </div>

      {show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShow(false) }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '700px', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>事项详情</span>
              <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', fontSize: '22px', color: '#94a3b8', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>标题 *</span>
                <input value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="必填" style={inp} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>时限</span>
                  <input type="date" value={form.deadline || ''} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inp} />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>来源</span>
                  <input value={form.source || ''} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="不填则为本单位" style={inp} />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>事项内容</span>
                <textarea value={form.content || ''} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="详细事务内容..." rows={5} style={{ ...inp, resize: 'vertical' }} />
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>办理意见</span>
                <textarea value={form.opinion || ''} onChange={e => setForm(f => ({ ...f, opinion: e.target.value }))} placeholder="请在此输入办理意见..." rows={3} style={{ ...inp, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                {(['通知', '任务'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="radio" name="itype" checked={form.type === v} onChange={() => setForm(f => ({ ...f, type: v }))} style={{ accentColor: '#2563eb' }} />
                    <span style={{ fontSize: '12px', color: '#475569' }}>{v}</span>
                  </label>
                ))}
                {(['一般', '加急'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="radio" name="ipri" checked={form.priority === v} onChange={() => setForm(f => ({ ...f, priority: v }))} style={{ accentColor: v === '加急' ? '#dc2626' : '#2563eb' }} />
                    <span style={{ fontSize: '12px', color: v === '加急' ? '#dc2626' : '#475569' }}>{v}</span>
                  </label>
                ))}
              </div>
              <button onClick={add} disabled={saving} style={{ padding: '9px 24px', borderRadius: '7px', border: 'none', background: saving ? '#94a3b8' : '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? '提交中...' : '✓ 提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
