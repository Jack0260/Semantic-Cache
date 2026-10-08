export interface CacheEntry {
  id: string;
  tenant_id: string;
  question: string;
  question_scrubbed: string;
  answer: string;
  answer_scrubbed: string;
  embedding: number[];
  model: string;
  tokens_saved: number;
  cost_saved: number;
  hit_count: number;
  similarity_threshold: number;
  created_at: number;
  expires_at: number;
  last_accessed: number;
  pii_flags: PIIFlag[];
}

export interface RequestLog {
  id: string;
  tenant_id: string;
  question: string;
  cache_hit: boolean;
  similarity_score: number | null;
  matched_entry_id: string | null;
  latency_ms: number;
  tokens: number;
  cost: number;
  cost_saved: number;
  model: string;
  pii_scrubbed: boolean;
  timestamp: number;
}

export interface Tenant {
  id: string;
  name: string;
  api_key_hash: string;
  similarity_threshold: number;
  cache_ttl_hours: number;
  total_requests: number;
  total_hits: number;
  total_cost_saved: number;
  created_at: number;
}

export interface PIIFlag {
  type: 'email' | 'phone' | 'ssn' | 'credit_card';
  original: string;
  masked: string;
}

export interface PIIScrubConfig {
  enabled: boolean;
  email: boolean;
  phone: boolean;
  ssn: boolean;
  credit_card: boolean;
}

export interface CacheConfig {
  similarity_threshold: number;
  cache_ttl_hours: number;
  pii_config: PIIScrubConfig;
  default_model: string;
}

export interface DashboardMetrics {
  total_requests: number;
  total_hits: number;
  hit_rate: number;
  total_cost_saved: number;
  p50_latency: number;
  p95_latency: number;
  p95_cache_hit_latency: number;
  p95_cache_miss_latency: number;
  total_tokens_saved: number;
  active_cache_entries: number;
  cost_reduction_percent: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  label: string;
  requests: number;
  hits: number;
  misses: number;
  hit_rate: number;
  cost_saved: number;
  p50_latency: number;
  p95_latency: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  _semantic_cache?: {
    hit: boolean;
    similarity_score: number | null;
    latency_ms: number;
    cost_saved: number;
  };
}
