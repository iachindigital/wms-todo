'use client'
import { useState, useEffect, useCallback } from 'react'

export default function BoxInventoryPage() {
  const [data,    setData]    = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{text:string;ok:boolean}|null>(null)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const [snapDate,setSnapDate]= useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: '2', page: String(page), pageSize: '50' })
      if (search) params.set('sku', search)
      const r = await fetch(`/api/inventory?${params}`)
      const d = await r.json()
      setData(d.inventory ?? [])
      setTotal(d.total ?? 0)
      setSnapDate(d.snapshot_date ?? '')
    } finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg({ text: '同步中...', ok: true })
    try {
      const r = await fetch('/api/inventory/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryType: 2 }),
      })
      const d = await r.json()
      if (d.success) { setSyncMsg({ text: `✅ 同步成功，共 ${d.synced} 条箱库存`, ok: true }); fetchData() }
      else setSyncMsg({ text: `❌ ${d.error}`, ok: false })
    } catch (e: any) { setSyncMsg({ text: `❌ ${e.message}`, ok: false }) }
    finally { setSyncing(false) }
  }

  const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600, color: '#64748b', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', background: '#f8fafc' }
  const td: React.CSSProperties = { padding: '9px 12px', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>📫 箱库存</h1>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>备货中转业务使用 · 箱类型维度{snapDate ? ` · 快照：${snapDate}` : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="搜索SKU/箱号..." onKeyDown={e => e.key === 'Enter' && fetchData()}
              style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
            <button onClick={handleSync} disabled={syncing}
              style={{ padding: '7px 14px', borderRadius: '7px', background: syncing ? '#e2e8f0' : '#7c3aed', border: 'none', color: syncing ? '#94a3b8' : '#fff', fontSize: '12px', fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer' }}>
              {syncing ? '同步中...' : '↻ 同步箱库存'}
            </button>
          </div>
        </div>
        {syncMsg && (
          <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', background: syncMsg.ok ? '#f0fdf4' : '#fef2f2', color: syncMsg.ok ? '#16a34a' : '#dc2626', border: `1px solid ${syncMsg.ok ? '#bbf7d0' : '#fecaca'}` }}>
            {syncMsg.text}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading ? <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>加载中...</div>
        : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📫</div>
            <div>暂无箱库存数据，请点击「同步箱库存」</div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead><tr>{['SKU', '产品名称', '箱号', '库位', '仓库', '可用量', '总量'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.map((item, i) => (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={td}><span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: 600 }}>{item.sku}</span></td>
                    <td style={{ ...td, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sku_name || '-'}</td>
                    <td style={td}><span style={{ fontFamily: 'monospace', fontSize: '11px', background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: '3px' }}>{item.box_no || '-'}</span></td>
                    <td style={td}>{item.location_code || '-'}</td>
                    <td style={td}>{item.warehouse_name || '-'}</td>
                    <td style={td}><span style={{ fontWeight: 700, color: item.available_qty > 0 ? '#16a34a' : '#dc2626' }}>{item.available_qty}</span></td>
                    <td style={td}>{item.total_qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#64748b' }}>共 {total} 条</div>
          </div>
        )}
      </div>
    </div>
  )
}
