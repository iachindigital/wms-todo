-- ============================================================
-- 009: 持久化任务表（替代 localStorage）
-- 修复：内部任务、长期任务、工作待办、便签 全部存入数据库
-- ============================================================

-- 工作待办（Dashboard 看板用）
CREATE TABLE IF NOT EXISTS work_todos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  done        BOOLEAN DEFAULT false,
  priority    TEXT DEFAULT 'medium',  -- high / medium / low
  created_at  TIMESTAMPTZ DEFAULT now(),
  done_at     TIMESTAMPTZ
);

-- 便签（Dashboard 可拖动便签）
CREATE TABLE IF NOT EXISTS sticky_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  text        TEXT DEFAULT '',
  color       TEXT DEFAULT '#fef9c3',
  pos_x       FLOAT DEFAULT 200,
  pos_y       FLOAT DEFAULT 200,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 内部任务
CREATE TABLE IF NOT EXISTS internal_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  deadline    DATE,
  source      TEXT DEFAULT '',
  content     TEXT DEFAULT '',
  opinion     TEXT DEFAULT '',
  type        TEXT DEFAULT '通知',    -- 通知 / 任务
  priority    TEXT DEFAULT '一般',    -- 一般 / 加急
  status      TEXT DEFAULT 'pending', -- pending / done
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 长期任务
CREATE TABLE IF NOT EXISTS long_term_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  biz_type        TEXT DEFAULT '',
  task_type       TEXT DEFAULT '',
  collaborators   TEXT[] DEFAULT '{}',
  end_date        DATE,
  status          TEXT DEFAULT 'active', -- active / done
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_work_todos_tenant   ON work_todos(tenant_id, done);
CREATE INDEX IF NOT EXISTS idx_sticky_notes_tenant ON sticky_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_internal_tasks_tenant ON internal_tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_long_term_tasks_tenant ON long_term_tasks(tenant_id, status);

-- RLS
ALTER TABLE work_todos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sticky_notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_tasks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE long_term_tasks  ENABLE ROW LEVEL SECURITY;

-- Policies (service role bypasses RLS, so these are for anon/authenticated access)
CREATE POLICY "work_todos_tenant" ON work_todos
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "work_todos_insert" ON work_todos FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "work_todos_update" ON work_todos FOR UPDATE
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "work_todos_delete" ON work_todos FOR DELETE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "sticky_notes_tenant" ON sticky_notes
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "sticky_notes_insert" ON sticky_notes FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "sticky_notes_update" ON sticky_notes FOR UPDATE
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "sticky_notes_delete" ON sticky_notes FOR DELETE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "internal_tasks_tenant" ON internal_tasks
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "internal_tasks_insert" ON internal_tasks FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "internal_tasks_update" ON internal_tasks FOR UPDATE
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "internal_tasks_delete" ON internal_tasks FOR DELETE
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "long_term_tasks_tenant" ON long_term_tasks
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "long_term_tasks_insert" ON long_term_tasks FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "long_term_tasks_update" ON long_term_tasks FOR UPDATE
  USING (tenant_id = get_my_tenant_id());
CREATE POLICY "long_term_tasks_delete" ON long_term_tasks FOR DELETE
  USING (tenant_id = get_my_tenant_id());
