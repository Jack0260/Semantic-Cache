/*
# Create Semantic Cache Schema

## Overview
This migration creates the database schema for an OpenAI-compatible semantic cache proxy.
The system caches LLM responses keyed by semantic similarity of user questions,
reducing API costs and latency. It supports multiple tenants, PII scrubbing, and
TTL-based cache invalidation.

## New Tables

### 1. tenants
Stores tenant (organization) configuration for multi-tenant cache isolation.
- id (text, primary key) — tenant identifier used in API headers
- name (text) — display name for the tenant
- api_key_hash (text) — masked API key for identification
- similarity_threshold (real, default 0.92) — minimum cosine similarity to serve cached response
- cache_ttl_hours (integer, default 24) — how long cache entries stay valid
- total_requests (integer, default 0) — running counter of all proxy requests
- total_hits (integer, default 0) — running counter of cache hits
- total_cost_saved (real, default 0) — running total of dollar amount saved
- created_at (timestamptz) — when the tenant was created

### 2. cache_entries
Stores cached question-answer pairs with their embedding vectors for semantic search.
- id (text, primary key) — unique cache entry identifier
- tenant_id (text, FK to tenants) — which tenant owns this entry
- question (text) — original user question (may contain PII, used for display in logs only)
- question_scrubbed (text) — PII-scrubbed version stored in cache
- answer (text) — original LLM response
- answer_scrubbed (text) — PII-scrubbed version stored in cache
- embedding (vector(256)) — 256-dimensional embedding for semantic similarity search
- model (text) — which LLM model was used
- tokens_saved (integer) — token count of the cached response
- cost_saved (real) — estimated cost per cache hit
- hit_count (integer, default 0) — how many times this entry has served a cache hit
- similarity_threshold (real) — threshold that was active when this entry was created
- created_at (timestamptz) — when the entry was cached
- expires_at (timestamptz) — TTL-based expiry timestamp
- last_accessed (timestamptz) — last time this entry served a cache hit
- pii_flags (jsonb) — array of PII types detected and scrubbed

### 3. request_logs
Records every request through the proxy for metrics and dashboards.
- id (text, primary key) — unique log entry identifier
- tenant_id (text, FK to tenants) — which tenant made the request
- question (text) — the user's question
- cache_hit (boolean) — whether the response was served from cache
- similarity_score (real, nullable) — cosine similarity of best match (null if no candidates)
- matched_entry_id (text, nullable, FK to cache_entries) — which cache entry was matched
- latency_ms (integer) — response latency in milliseconds
- tokens (integer) — token count of the response
- cost (real) — LLM API cost (0 for cache hits)
- cost_saved (real) — dollar amount saved by cache hit (0 for misses)
- model (text) — which model was requested
- pii_scrubbed (boolean) — whether PII was detected and scrubbed
- timestamp (timestamptz) — when the request was processed

### 4. cache_config
Stores global cache configuration settings.
- id (integer, primary key, default 1) — singleton config row
- similarity_threshold (real, default 0.92) — global default similarity threshold
- cache_ttl_hours (integer, default 24) — global default cache TTL
- default_model (text, default 'gpt-4o') — default model when not specified
- pii_enabled (boolean, default true) — master PII scrubbing switch
- pii_email (boolean, default true) — scrub email addresses
- pii_phone (boolean, default true) — scrub phone numbers
- pii_ssn (boolean, default true) — scrub social security numbers
- pii_credit_card (boolean, default true) — scrub credit card numbers
- updated_at (timestamptz) — last configuration update

## Security
- RLS enabled on all tables.
- This is a no-auth application (no sign-in screen). All policies use `TO anon, authenticated`
  with `USING (true)` / `WITH CHECK (true)` because the data is intentionally shared across
  all users of the dashboard. There is no user-scoped data isolation.
- The proxy and dashboard run with the anon key.

## Indexes
- ivfflat index on cache_entries.embedding for fast approximate nearest-neighbor search
- index on cache_entries.tenant_id for tenant-filtered queries
- index on cache_entries.expires_at for TTL-based invalidation sweeps
- index on request_logs.tenant_id for tenant-filtered log queries
- index on request_logs.timestamp for time-series chart queries
- index on request_logs.cache_hit for hit/miss filtering

## Important Notes
1. The vector extension (pgvector) must be enabled before creating cache_entries.
2. The ivfflat index uses `vector_cosine_ops` since we use cosine similarity.
3. The cache_config table has a singleton pattern with id=1, enforced by a CHECK constraint.
4. Foreign keys use ON DELETE CASCADE so deleting a tenant removes its cache entries and logs.
*/
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  api_key_hash text NOT NULL DEFAULT '',
  similarity_threshold real NOT NULL DEFAULT 0.92,
  cache_ttl_hours integer NOT NULL DEFAULT 24,
  total_requests integer NOT NULL DEFAULT 0,
  total_hits integer NOT NULL DEFAULT 0,
  total_cost_saved real NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cache_entries (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question text NOT NULL,
  question_scrubbed text NOT NULL,
  answer text NOT NULL,
  answer_scrubbed text NOT NULL,
  embedding vector(256) NOT NULL,
  model text NOT NULL DEFAULT 'gpt-4o',
  tokens_saved integer NOT NULL DEFAULT 0,
  cost_saved real NOT NULL DEFAULT 0,
  hit_count integer NOT NULL DEFAULT 0,
  similarity_threshold real NOT NULL DEFAULT 0.92,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  last_accessed timestamptz NOT NULL DEFAULT now(),
  pii_flags jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS request_logs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question text NOT NULL,
  cache_hit boolean NOT NULL DEFAULT false,
  similarity_score real,
  matched_entry_id text REFERENCES cache_entries(id) ON DELETE SET NULL,
  latency_ms integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  cost real NOT NULL DEFAULT 0,
  cost_saved real NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT 'gpt-4o',
  pii_scrubbed boolean NOT NULL DEFAULT false,
  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cache_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  similarity_threshold real NOT NULL DEFAULT 0.92,
  cache_ttl_hours integer NOT NULL DEFAULT 24,
  default_model text NOT NULL DEFAULT 'gpt-4o',
  pii_enabled boolean NOT NULL DEFAULT true,
  pii_email boolean NOT NULL DEFAULT true,
  pii_phone boolean NOT NULL DEFAULT true,
  pii_ssn boolean NOT NULL DEFAULT true,
  pii_credit_card boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO cache_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cache_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_tenants" ON tenants;
CREATE POLICY "anon_select_tenants" ON tenants FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_tenants" ON tenants;
CREATE POLICY "anon_insert_tenants" ON tenants FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_tenants" ON tenants;
CREATE POLICY "anon_update_tenants" ON tenants FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_tenants" ON tenants;
CREATE POLICY "anon_delete_tenants" ON tenants FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_cache_entries" ON cache_entries;
CREATE POLICY "anon_select_cache_entries" ON cache_entries FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_cache_entries" ON cache_entries;
CREATE POLICY "anon_insert_cache_entries" ON cache_entries FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_cache_entries" ON cache_entries;
CREATE POLICY "anon_update_cache_entries" ON cache_entries FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_cache_entries" ON cache_entries;
CREATE POLICY "anon_delete_cache_entries" ON cache_entries FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_request_logs" ON request_logs;
CREATE POLICY "anon_select_request_logs" ON request_logs FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_request_logs" ON request_logs;
CREATE POLICY "anon_insert_request_logs" ON request_logs FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_request_logs" ON request_logs;
CREATE POLICY "anon_update_request_logs" ON request_logs FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_request_logs" ON request_logs;
CREATE POLICY "anon_delete_request_logs" ON request_logs FOR DELETE
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_cache_config" ON cache_config;
CREATE POLICY "anon_select_cache_config" ON cache_config FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_cache_config" ON cache_config;
CREATE POLICY "anon_insert_cache_config" ON cache_config FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_cache_config" ON cache_config;
CREATE POLICY "anon_update_cache_config" ON cache_config FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_cache_config" ON cache_config;
CREATE POLICY "anon_delete_cache_config" ON cache_config FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cache_entries_tenant_id ON cache_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_tenant_id ON request_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp ON request_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_cache_hit ON request_logs(cache_hit);

CREATE INDEX IF NOT EXISTS idx_cache_entries_embedding
ON cache_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
