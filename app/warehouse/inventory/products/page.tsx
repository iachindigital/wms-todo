'use client'
import { useState, useEffect, useCallback } from 'react'

interface InventoryItem {
  id: string; sku: string; sku_name: string; location_code: string
  warehouse_name: string; available_qty: number; total_qty: number; locked_qty: number; snapshot_date: string
}
interface FlowRecord {
  sku: string; changeQty: number; afterQty: number; beforeQty: number
  orderType: string; orderNo: string; batchNo: string; warehouseName: string; createTime: string
}

type TabType = 'products' | 'locations' | 'flow'

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: 'products',  label: '按产品查询', icon: '📦' },
  { key: 'locations', label: '按库位查询', icon: '📍' },
  { key: 'flow',      label: '库存流水',   icon: '📋' },
]

export default function InventoryProductsPage() {
  const [tab,       setTab]       = useState<TabType>('products')
  const [data,      setData]      = useState<InventoryItem[]>([])
  const [flowData,  setFlowData]  = useState<FlowRecord[]>([])
  const [loading,   setLoading]   = useState(false)
  const [syncing,   setSyncing]   = useState(false)
  const [syncMsg,   setSyncMsg]   = useState<{text:string;ok:boolean}|null>(null)
  const [total,     setTotal]     = useState(0)
  const [flowTotal, setFlowTotal] = useState(0)
  const [page,      setPage]      = useState(1)
  const [flowPage,  setFlowPage]  = useState(1)
  const [search,    setSearch]    = useState('')
  const [snapDate,  setSnapDate]  = useState('')
  const [clients,   setClients]   = useState<{customer_code:string;customer_name:string}[]>([])
  const [selClient, setSelClient] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const PAGE_SIZE = 50

  // 加载已绑定客户列表
  useEffect(() => {
    fetch('/api/oms-clients').then(r => r.json()).then(d => {
      const bound = (d.clients ?? []).filter((c: any) => c.auth_status === 1)
      setClients(bound)
      if (bound.length === 1) setSelClient(bound[0].customer_code)
    }).catch(() => {})
  }, [])

  // 加载库存快照（本地DB）
  const fetchData = useCallback(async () => {
    if (tab === 'flow') return
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: '1', page: String(page), pageSize: String(PAGE_SIZE) })
      if (search) {
        if (tab === 'products')  params.set('sku', search)
        if (tab === 'locations') params.set('location', search)
      }
      const r = await fetch(`/api/inventory?${params}`)
      const d = await r.json()
      setData(d.inventory ?? [])
      setTotal(d.total ?? 0)
      setSnapDate(d.snapshot_date ?? '')
    } finally { setLoading(false) }
  }, [tab, page, search])

  // 加载库存流水（领星实时）
  const fetchFlow = useCallback(async () => {
    if (tab !== 'flow') return
    setLoading(true)
    try {
      const params = new URLSearchParams({ pageNum: String(flowPage), pageSize: String(PAGE_SIZE) })
      if (search) params.set('sku', search)
      const r = await fetch(`/api/inventory/flow?${params}`)
      const d = await r.json()
      if (d.error) { setSyncMsg({ text: `❌ ${d.error}`, ok: false }); return }
      setFlowData(d.records ?? [])
      setFlowTotal(d.total ?? 0)
    } finally { setLoading(false) }
  }, [tab, flowPage, search])

  useEffect(() => {
    if (tab === 'flow') fetchFlow()
    else fetchData()
  }, [tab, fetchData, fetchFlow])

  // 同步库存
  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg({ text: '同步中，请稍候...', ok: true })
    try {
      const r = await fetch('/api/inventory/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryType: 1, customerCode: selClient }), // 1=产品库存
      })
      const d = await r.json()
      if (d.success) {
        setSyncMsg({ text: `✅ 同步成功，共 ${d.synced} 条产品库存`, ok: true })
        await fetchData()
      } else {
        setSyncMsg({ text: `❌ ${d.error}`, ok: false })
      }
    } catch (e: any) {
      setSyncMsg({ text: `❌ ${e.message}`, ok: false })
    } finally { setSyncing(false) }
  }

  // 上传产品资料 Excel
  const handleUploadSpecs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setSyncMsg(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      // 可选：添加 tenantId
      // formData.append('tenantId', currentTenantId)

      const r = await fetch('/api/products/upload-specs', { method: 'POST', body: formData })
      const d = await r.json()
      if (r.ok) {
        setSyncMsg({
          text: `✅ 导入成功！新增 ${d.newRows} 条，更新 ${d.updatedRows} 条。（跳过空行 ${d.skippedRows} 条）`,
          ok: true
        })
        fetchData()
      } else {
        setSyncMsg({ text: `❌ ${d.error || '导入失败'}`, ok: false })
      }
    } catch (err: any) {
      setSyncMsg({ text: `❌ 导入异常: ${err.message}`, ok: false })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 按库位汇总
  const locationGroups = data.reduce((acc, item) => {
    const loc = item.location_code || '(无库位)'
    if (!acc[loc]) acc[loc] = { location_code: loc, warehouse_name: item.warehouse_name, skus: [], total_qty: 0 }
    acc[loc].skus.push(item)
    acc[loc].total_qty += item.available_qty
    return acc
  }, {} as Record<string, { location_code: string; warehouse_name: string; skus: InventoryItem[]; total_qty: number }>)

  const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600, color: '#64748b', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '11px', whiteSpace: 'nowrap', background: '#f8fafc' }
  const td: React.CSSProperties = { padding: '9px 12px', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
      {/* 标题栏 */}
      <div style={{ padding: '14px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>📦 产品库存</h1>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              {tab === 'flow'
                ? '库存流水来自领星实时数据 · 暂只支持产品库存'
                : snapDate ? `快照日期：${snapDate}` : '点击「同步领星库存」拉取最新数据'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); setFlowPage(1) }}
              placeholder={tab === 'locations' ? '搜索库位...' : '搜索SKU...'}
              onKeyDown={e => e.key === 'Enter' && (tab === 'flow' ? fetchFlow() : fetchData())}
              style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', outline: 'none', width: '180px' }} />
            {tab !== 'flow' && (
              <>
                {clients.length > 1 && (
                  <select value={selClient} onChange={e => setSelClient(e.target.value)}
                    style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
                    <option value="">全部客户</option>
                    {clients.map(c => (
                      <option key={c.customer_code} value={c.customer_code}>{c.customer_name} ({c.customer_code})</option>
                    ))}
                  </select>
                )}
                {tab === 'products' && (
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    style={{ padding: '7px 14px', borderRadius: '7px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {uploading ? '⏳ 解析中...' : '📤 导入尺码库'}
                  </button>
                )}
                <button onClick={handleSync} disabled={syncing}
                  style={{ padding: '7px 14px', borderRadius: '7px', background: syncing ? '#e2e8f0' : '#2563eb', border: 'none', color: syncing ? '#94a3b8' : '#fff', fontSize: '12px', fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer' }}>
                  {syncing ? '同步中...' : '↻ 同步领星库存'}
                </button>
              </>
            )}
            {tab === 'flow' && (
              <button onClick={fetchFlow} disabled={loading}
                style={{ padding: '7px 14px', borderRadius: '7px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', cursor: 'pointer' }}>
                ↻ 刷新
              </button>
            )}
          </div>
        </div>
        {syncMsg && (
          <div style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '12px', background: syncMsg.ok ? '#f0fdf4' : '#fef2f2', color: syncMsg.ok ? '#16a34a' : '#dc2626', border: `1px solid ${syncMsg.ok ? '#bbf7d0' : '#fecaca'}`, marginBottom: '10px' }}>
            {syncMsg.text}
          </div>
        )}
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1); setSearch(''); setSyncMsg(null) }}
              style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: tab === t.key ? '#2563eb' : '#f1f5f9', color: tab === t.key ? '#fff' : '#475569', fontFamily: 'inherit' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>加载中...</div>
        ) : tab === 'flow' ? (
          // 库存流水视图
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {flowData.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>📋</div>
                <div>暂无库存流水数据</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead><tr>{['SKU', '仓库', '业务类型', '单据号', '变化量', '变后库存', '时间'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {flowData.map((item, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={td}><span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>{item.sku}</span></td>
                      <td style={td}>{item.warehouseName || '-'}</td>
                      <td style={td}><span style={{ padding: '1px 6px', background: '#f1f5f9', borderRadius: '4px', fontSize: '11px' }}>{item.orderType || '-'}</span></td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: '11px' }}>{item.orderNo || '-'}</td>
                      <td style={td}><span style={{ fontWeight: 700, color: (item.changeQty || 0) >= 0 ? '#16a34a' : '#dc2626' }}>{(item.changeQty || 0) >= 0 ? '+' : ''}{item.changeQty}</span></td>
                      <td style={td}>{item.afterQty ?? '-'}</td>
                      <td style={{ ...td, color: '#64748b', fontSize: '11px' }}>{item.createTime || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
              <span>共 {flowTotal} 条</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setFlowPage(p => Math.max(1, p - 1))} disabled={flowPage === 1}
                  style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #e2e8f0', background: flowPage === 1 ? '#f8fafc' : '#fff', cursor: flowPage === 1 ? 'not-allowed' : 'pointer', fontSize: '11px' }}>← 上一页</button>
                <span style={{ padding: '4px 10px' }}>第 {flowPage} 页</span>
                <button onClick={() => setFlowPage(p => p + 1)} disabled={flowData.length < PAGE_SIZE}
                  style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #e2e8f0', background: flowData.length < PAGE_SIZE ? '#f8fafc' : '#fff', cursor: flowData.length < PAGE_SIZE ? 'not-allowed' : 'pointer', fontSize: '11px' }}>下一页 →</button>
              </div>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📦</div>
            <div style={{ fontSize: '14px', marginBottom: '8px' }}>暂无库存数据</div>
            <div style={{ fontSize: '12px' }}>请点击「同步领星库存」拉取最新数据</div>
          </div>
        ) : tab === 'locations' ? (
          // 按库位视图
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fde68a', fontSize: '11px', color: '#92400e' }}>
              ⚠️ 综合库存接口不含库位信息。库位数据需要先在「盘点单」接口中获取（请使用「库位管理」页面同步）。
            </div>
            {Object.values(locationGroups).map(loc => (
              <div key={loc.location_code} style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '14px' }}>📍</span>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{loc.location_code}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>{loc.warehouse_name}</span>
                  <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '12px', background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: 600 }}>
                    合计 {loc.total_qty} 件
                  </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead><tr>{['SKU', '产品名称', '可用', '总量', '锁定'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {loc.skus.map(item => (
                      <tr key={item.id}>
                        <td style={td}><span style={{ fontFamily: 'monospace', color: '#2563eb' }}>{item.sku}</span></td>
                        <td style={{ ...td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sku_name || '-'}</td>
                        <td style={td}><span style={{ fontWeight: 700, color: item.available_qty > 0 ? '#16a34a' : '#dc2626' }}>{item.available_qty}</span></td>
                        <td style={td}>{item.total_qty}</td>
                        <td style={td}>{item.locked_qty > 0 ? <span style={{ color: '#d97706' }}>{item.locked_qty}</span> : '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          // 按产品视图（默认）
          <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead><tr>{['SKU', '产品名称', '仓库', '可用库存', '总库存', '在途', '锁定'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {data.map((item, i) => (
                  <tr key={item.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={td}><span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>{item.sku}</span></td>
                    <td style={{ ...td, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sku_name || '-'}</td>
                    <td style={{ ...td, color: '#64748b', fontSize: '11px' }}>{item.warehouse_name || '-'}</td>
                    <td style={td}><span style={{ fontWeight: 800, color: item.available_qty > 10 ? '#16a34a' : item.available_qty > 0 ? '#d97706' : '#dc2626', fontSize: '15px' }}>{item.available_qty}</span></td>
                    <td style={td}>{item.total_qty}</td>
                    <td style={td}><span style={{ color: '#94a3b8' }}>{(item as any).transport_qty ?? '-'}</span></td>
                    <td style={td}>{item.locked_qty > 0 ? <span style={{ color: '#d97706' }}>{item.locked_qty}</span> : <span style={{ color: '#94a3b8' }}>0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
              <span>共 {total} 条 · 数据来源：领星WMS综合库存快照</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #e2e8f0', background: page === 1 ? '#f8fafc' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: '11px' }}>← 上一页</button>
                <span style={{ padding: '4px 10px' }}>第 {page} 页</span>
                <button onClick={() => setPage(p => p + 1)} disabled={data.length < PAGE_SIZE}
                  style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid #e2e8f0', background: data.length < PAGE_SIZE ? '#f8fafc' : '#fff', cursor: data.length < PAGE_SIZE ? 'not-allowed' : 'pointer', fontSize: '11px' }}>下一页 →</button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <input type="file" accept=".xlsx,.xls,.csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleUploadSpecs} />
    </div>
  )
}
