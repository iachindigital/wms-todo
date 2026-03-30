-- Migration 008: 同步日志表
-- 记录每次自动/手动同步的结果，供页面展示

CREATE TABLE IF NOT EXISTS sync_logs (
  id           BIGSERIAL PRIMARY KEY,
  synced_at    TIMESTAMPTZ DEFAULT NOW(),
  trigger      TEXT DEFAULT 'manual',   -- 'manual' | 'cron' | 'auto'
  client_code  TEXT,
  client_name  TEXT,
  sync_type    TEXT,                    -- outbound | inbound | returns | inventory
  created      INTEGER DEFAULT 0,
  updated      INTEGER DEFAULT 0,
  skipped      INTEGER DEFAULT 0,
  error        TEXT,
  duration_ms  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_time ON sync_logs(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_client ON sync_logs(client_code);

ALTER TABLE sync_logs DISABLE ROW LEVEL SECURITY;

-- 自动清理30天前的日志（保持表小）
-- 可在 Supabase 的 pg_cron 里设置，或手动运行
-- DELETE FROM sync_logs WHERE synced_at < NOW() - INTERVAL '30 days';
