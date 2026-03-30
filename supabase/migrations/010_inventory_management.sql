-- ============================================================
-- 010: 库内管理（库存、产品规格、库位体积管理）
-- 已核实领星API（2026-03-27通过浏览器核实）：
-- 综合库存: POST /v1/integratedInventory/pageOpen
--   - stockType: 0=产品库存, 1=箱库存, 2=退货库存
--   - 分页参数: pageNum/pageSize（不是page）
--   - 字段: productStockDtl.availableAmount/lockAmount
--   - 不含库位(cellNo)！库位在盘点单接口
-- 产品列表: POST /v1/product/pagelist (小写l)
--   - 字段: length/width/height(cm), weight(kg)
-- 盘点单: POST /v1/integratedInventory/order/check/detail
--   - 含 cellNo(库位编码), areaNo(库区编码)
-- ============================================================

-- 产品规格缓存（从领星同步，含长宽高重量）
CREATE TABLE IF NOT EXISTS product_specs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku              TEXT NOT NULL,
  name             TEXT DEFAULT '',
  length_cm        NUMERIC DEFAULT 0,
  width_cm         NUMERIC DEFAULT 0,
  height_cm        NUMERIC DEFAULT 0,
  weight_kg        NUMERIC DEFAULT 0,
  synced_at        TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, sku)
);

-- 库位信息（从盘点单接口获取 cellNo/areaNo，手动维护最大容积）
CREATE TABLE IF NOT EXISTS locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_code    TEXT NOT NULL,
  area_code        TEXT DEFAULT '',
  area_type        INTEGER,
  area_type_name   TEXT DEFAULT '',
  warehouse_code   TEXT DEFAULT '',
  warehouse_name   TEXT DEFAULT '',
  max_volume_cm3   NUMERIC DEFAULT 0,
  warning_ratio    NUMERIC DEFAULT 0.85,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  synced_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, location_code)
);

-- 库存快照（每次同步覆盖当天数据）
-- inventory_type: 1=产品库存 2=箱库存 3=退货库存（内部编号，领星 stockType=0/1/2）
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inventory_type   INTEGER NOT NULL DEFAULT 1,
  sku              TEXT NOT NULL,
  sku_name         TEXT DEFAULT '',
  location_code    TEXT DEFAULT '',
  warehouse_code   TEXT DEFAULT '',
  warehouse_name   TEXT DEFAULT '',
  available_qty    INTEGER DEFAULT 0,
  total_qty        INTEGER DEFAULT 0,
  locked_qty       INTEGER DEFAULT 0,
  fnsku            TEXT DEFAULT '',
  box_no           TEXT DEFAULT '',
  snapshot_date    DATE DEFAULT CURRENT_DATE,
  synced_at        TIMESTAMPTZ DEFAULT now(),
  raw_data         JSONB,
  UNIQUE(tenant_id, inventory_type, sku, location_code, snapshot_date)
);

-- 补货单
CREATE TABLE IF NOT EXISTS replenishment_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_code    TEXT NOT NULL,
  warehouse_code   TEXT DEFAULT '',
  trigger_reason   TEXT DEFAULT '',
  usage_ratio      NUMERIC DEFAULT 0,
  status           TEXT DEFAULT 'pending',
  notes            TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_product_specs_tenant_sku       ON product_specs(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_locations_tenant               ON locations(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_tenant     ON inventory_snapshots(tenant_id, inventory_type, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_sku        ON inventory_snapshots(tenant_id, sku, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_replenishment_tenant           ON replenishment_orders(tenant_id, status);

-- RLS
ALTER TABLE product_specs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE replenishment_orders   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_specs_tenant"        ON product_specs        USING (tenant_id = get_my_tenant_id());
CREATE POLICY "locations_tenant"            ON locations             USING (tenant_id = get_my_tenant_id());
CREATE POLICY "inventory_snapshots_tenant"  ON inventory_snapshots   USING (tenant_id = get_my_tenant_id());
CREATE POLICY "replenishment_tenant"        ON replenishment_orders  USING (tenant_id = get_my_tenant_id());
