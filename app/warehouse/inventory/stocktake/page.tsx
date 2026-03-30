'use client'
import { useState, useEffect, useCallback } from 'react'

export default function StocktakePage() {
  const [data,    setData]    = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search,  setSearch]  = useState('')
  const [snapDate,setSnapDate]= useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: '1', pageSize: '200' })
      if (search) params.set('sku', search)
      const r = await fetch(`/api/inventory?${params}`)
      const d = await r.json()
      setData(d.inventory ?? [])
      setSnapDate(d.snapshot_date ?? '')
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  // 按库位汇总做盘点表
  const locationGroups = data.reduce((acc, item) => {
    const loc = item.location_code || '无库位'
    if (!acc[loc]) acc[loc] = { location_code: loc, warehouse_name: item.warehouse_name, items: [] }
    acc[loc].items.push(item)
    return acc
  }, {} as Record<string, any>)

  const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600, color: '#64748b', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', background: '#f8fafc' }
  const td: React.CSSProperties = { padding: '9px 12px', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>🔍 库存盘点</h1>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              按库位展示当前库存实物 · 可对照系统数据进行盘点
              {snapDate ? ` · 数据时间：${snapDate}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索SKU..." onKeyDown={e => e.key === 'Enter' && fetchData()}
              style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', outline: 'none' }} />
            <button onClick={() => window.print()}
              style={{ padding: '7px 14px', borderRadius: '7px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', cursor: 'pointer' }}>
              🖨️ 打印盘点表
            </button>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading ? <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>加载中...</div>
        : Object.keys(locationGroups).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
            <div>暂无库存数据，请先在「产品库存」中同步数据</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.values(locationGroups).map((group: any) => (
              <div key={group.location_code} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '14px' }}>📍 {group.location_code}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{group.warehouse_name}</span>
                  <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '12px', background: '#334155', color: '#94a3b8', fontSize: '11px' }}>
                    {group.items.length} 个SKU
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['SKU', '产品名称', '系统库存', '实盘数量', '差异', '备注'].map(h => <th key={h} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item: any, i: number) => (
                      <tr key={item.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                        <td style={td}><span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#2563eb' }}>{item.sku}</span></td>
                        <td style={{ ...td, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sku_name || '-'}</td>
                        <td style={td}><span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>{item.available_qty}</span></td>
                        <td style={td}>
                          <input type="number" placeholder="填写实盘"
                            style={{ width: '80px', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px', outline: 'none' }} />
                        </td>
                        <td style={td}><span style={{ color: '#94a3b8', fontSize: '11px' }}>—</span></td>
                        <td style={td}>
                          <input type="text" placeholder="备注..."
                            style={{ width: '120px', padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '12px', outline: 'none' }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
