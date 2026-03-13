CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(20) NOT NULL CHECK (source IN ('amazon', 'coupang', '11st', 'gmarket')),
  external_id VARCHAR(120) NOT NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  affiliate_url TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, external_id)
);

CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'KRW',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS price_history_product_time_idx
  ON price_history (product_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS click_events (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  referrer TEXT,
  session_id VARCHAR(120),
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS affiliate_reports (
  id BIGSERIAL PRIMARY KEY,
  source VARCHAR(20) NOT NULL CHECK (source IN ('amazon', 'coupang', '11st', 'gmarket')),
  report_date DATE NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  commission NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, report_date)
);

CREATE TABLE IF NOT EXISTS watch_jobs (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('amazon', 'coupang', '11st', 'gmarket')),
  external_id VARCHAR(120) NOT NULL,
  product_url TEXT NOT NULL,
  target_price NUMERIC(12, 2),
  notify_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_checked_at TIMESTAMPTZ,
  last_price NUMERIC(12, 2),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS watch_jobs_active_idx
  ON watch_jobs (is_active, source, external_id);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  watch_job_id BIGINT NOT NULL REFERENCES watch_jobs(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  notification_type VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  payload JSONB,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'sent'
);
