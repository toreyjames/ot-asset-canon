CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  entity TEXT NOT NULL DEFAULT 'Unknown',
  sector TEXT NOT NULL DEFAULT 'manufacturing',
  signal_type TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT 'United States',
  value NUMERIC DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  ot_relevance_score NUMERIC NOT NULL DEFAULT 0,
  ot_keywords TEXT[] NOT NULL DEFAULT '{}',
  raw_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_source ON signals(source);
CREATE INDEX IF NOT EXISTS idx_signals_sector ON signals(sector);
CREATE INDEX IF NOT EXISTS idx_signals_signal_type ON signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_signals_ot_relevance ON signals(ot_relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_signals_source_id ON signals(source, source_id);
