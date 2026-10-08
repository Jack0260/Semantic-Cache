import { CacheEntry, RequestLog, Tenant, CacheConfig, DashboardMetrics, TimeSeriesPoint, ChatCompletionRequest, ChatCompletionResponse } from './types';
import { embed, cosineSimilarity } from './embeddings';
import { scrubPII } from './pii';
import { generateSeedData, DEFAULT_CONFIG } from './mock-data';

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
};

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS['gpt-4o'];
  return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
}

const SIMULATED_ANSWERS = [
  'Based on our current documentation, the feature you are asking about is supported and can be configured through the admin dashboard under Settings > Advanced. Please refer to our API documentation for detailed integration steps.',
  'Thank you for your question. This is a common inquiry. Our system processes requests in the order they are received, typically within 1-2 business days. You will receive an email notification once processing is complete.',
  'The answer depends on your current plan tier. Free tier users have a limit of 100 requests per day, while Pro and Enterprise tiers have configurable limits. You can adjust these in your billing settings.',
  'We take this matter seriously. Our team has implemented comprehensive measures to address this. All relevant data is encrypted and stored in compliance with industry standards. For specific details, please consult our security documentation.',
  'Yes, this functionality is available. You can access it through the main navigation menu. If you do not see the option, ensure your account has the necessary permissions. Contact your administrator if you need access granted.',
];

class SemanticCacheStore {
  private entries: CacheEntry[] = [];
  private logs: RequestLog[] = [];
  private tenants: Tenant[] = [];
  private config: CacheConfig = DEFAULT_CONFIG;
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;
    const data = generateSeedData();
    this.entries = data.entries;
    this.logs = data.logs;
    this.tenants = data.tenants;
    this.config = { ...DEFAULT_CONFIG };
    this.initialized = true;
  }

  getConfig(): CacheConfig {
    this.initialize();
    return { ...this.config };
  }

  updateConfig(updates: Partial<CacheConfig>): void {
    this.initialize();
    this.config = { ...this.config, ...updates };
  }

  getTenants(): Tenant[] {
    this.initialize();
    return [...this.tenants];
  }

  getTenant(id: string): Tenant | null {
    this.initialize();
    return this.tenants.find(t => t.id === id) || null;
  }

  addTenant(name: string, similarityThreshold: number, cacheTtlHours: number): Tenant {
    this.initialize();
    const id = `tenant_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
    const tenant: Tenant = {
      id,
      name,
      api_key_hash: `sk-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}-****-${Date.now().toString(36).slice(-4)}`,
      similarity_threshold: similarityThreshold,
      cache_ttl_hours: cacheTtlHours,
      total_requests: 0,
      total_hits: 0,
      total_cost_saved: 0,
      created_at: Date.now(),
    };
    this.tenants.push(tenant);
    return tenant;
  }

  getEntries(tenantId?: string): CacheEntry[] {
    this.initialize();
    let result = this.entries;
    if (tenantId && tenantId !== 'all') {
      result = result.filter(e => e.tenant_id === tenantId);
    }
    return [...result].sort((a, b) => b.last_accessed - a.last_accessed);
  }

  invalidateEntry(entryId: string): void {
    this.initialize();
    this.entries = this.entries.filter(e => e.id !== entryId);
  }

  invalidateByTenant(tenantId: string): void {
    this.initialize();
    this.entries = this.entries.filter(e => e.tenant_id !== tenantId);
  }

  invalidateAll(): void {
    this.initialize();
    this.entries = [];
  }

  getLogs(tenantId?: string, limit?: number): RequestLog[] {
    this.initialize();
    let result = [...this.logs].sort((a, b) => b.timestamp - a.timestamp);
    if (tenantId && tenantId !== 'all') {
      result = result.filter(l => l.tenant_id === tenantId);
    }
    if (limit) result = result.slice(0, limit);
    return result;
  }

  proxyRequest(
    request: ChatCompletionRequest,
    tenantId: string
  ): ChatCompletionResponse {
    this.initialize();
    const startTime = Date.now();
    const lastMessage = request.messages[request.messages.length - 1];
    const question = lastMessage?.content || '';
    const model = request.model || this.config.default_model;

    const tenant = this.tenants.find(t => t.id === tenantId);
    const threshold = tenant?.similarity_threshold || this.config.similarity_threshold;
    const ttlHours = tenant?.cache_ttl_hours || this.config.cache_ttl_hours;

    // Generate embedding for the query
    const queryEmbedding = embed(question);

    // Search cache for semantically similar questions
    let bestMatch: CacheEntry | null = null;
    let bestScore = 0;

    for (const entry of this.entries) {
      if (entry.tenant_id !== tenantId) continue;
      if (Date.now() > entry.expires_at) continue;

      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    const isHit = bestMatch !== null && bestScore >= threshold;
    const latency = Date.now() - startTime;

    if (isHit && bestMatch) {
      // Cache hit: return cached response
      const hitLatency = latency + 15 + Math.floor(Math.random() * 30);
      bestMatch.hit_count += 1;
      bestMatch.last_accessed = Date.now();

      const response: ChatCompletionResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: bestMatch.model,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: bestMatch.answer },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: estimateTokens(question),
          completion_tokens: bestMatch.tokens_saved,
          total_tokens: estimateTokens(question) + bestMatch.tokens_saved,
        },
        _semantic_cache: {
          hit: true,
          similarity_score: bestScore,
          latency_ms: hitLatency,
          cost_saved: bestMatch.cost_saved,
        },
      };

      this.logs.unshift({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        tenant_id: tenantId,
        question,
        cache_hit: true,
        similarity_score: bestScore,
        matched_entry_id: bestMatch.id,
        latency_ms: hitLatency,
        tokens: bestMatch.tokens_saved,
        cost: 0,
        cost_saved: bestMatch.cost_saved,
        model: bestMatch.model,
        pii_scrubbed: false,
        timestamp: Date.now(),
      });

      if (tenant) {
        tenant.total_requests += 1;
        tenant.total_hits += 1;
        tenant.total_cost_saved += bestMatch.cost_saved;
      }

      return response;
    }

    // Cache miss: simulate LLM call
    const missLatency = latency + 1400 + Math.floor(Math.random() * 800);
    const answer = SIMULATED_ANSWERS[Math.floor(Math.random() * SIMULATED_ANSWERS.length)];
    const inputTokens = estimateTokens(question);
    const outputTokens = estimateTokens(answer);
    const cost = estimateCost(model, inputTokens, outputTokens);

    // Scrub PII before caching
    const { scrubbed: qScrubbed, flags } = scrubPII(question, this.config.pii_config);
    const { scrubbed: aScrubbed } = scrubPII(answer, this.config.pii_config);

    // Store in cache
    const newEntry: CacheEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      tenant_id: tenantId,
      question,
      question_scrubbed: qScrubbed,
      answer,
      answer_scrubbed: aScrubbed,
      embedding: queryEmbedding,
      model,
      tokens_saved: outputTokens,
      cost_saved: cost,
      hit_count: 0,
      similarity_threshold: threshold,
      created_at: Date.now(),
      expires_at: Date.now() + ttlHours * 60 * 60 * 1000,
      last_accessed: Date.now(),
      pii_flags: flags,
    };
    this.entries.push(newEntry);

    const response: ChatCompletionResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: answer },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
      _semantic_cache: {
        hit: false,
        similarity_score: bestScore > 0 ? bestScore : null,
        latency_ms: missLatency,
        cost_saved: 0,
      },
    };

    this.logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      tenant_id: tenantId,
      question,
      cache_hit: false,
      similarity_score: bestScore > 0 ? bestScore : null,
      matched_entry_id: null,
      latency_ms: missLatency,
      tokens: outputTokens,
      cost,
      cost_saved: 0,
      model,
      pii_scrubbed: flags.length > 0,
      timestamp: Date.now(),
    });

    if (tenant) {
      tenant.total_requests += 1;
    }

    return response;
  }

  getMetrics(tenantId?: string): DashboardMetrics {
    this.initialize();
    let logs = this.logs;
    if (tenantId && tenantId !== 'all') {
      logs = logs.filter(l => l.tenant_id === tenantId);
    }

    const totalRequests = logs.length;
    const totalHits = logs.filter(l => l.cache_hit).length;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    const totalCostSaved = logs.reduce((s, l) => s + l.cost_saved, 0);
    const totalTokensSaved = logs.filter(l => l.cache_hit).reduce((s, l) => s + l.tokens, 0);

    const latencies = logs.map(l => l.latency_ms).sort((a, b) => a - b);
    const hitLatencies = logs.filter(l => l.cache_hit).map(l => l.latency_ms).sort((a, b) => a - b);
    const missLatencies = logs.filter(l => !l.cache_hit).map(l => l.latency_ms).sort((a, b) => a - b);

    const percentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const idx = Math.ceil(arr.length * p) - 1;
      return arr[Math.max(0, Math.min(idx, arr.length - 1))];
    };

    const p50 = percentile(latencies, 0.5);
    const p95 = percentile(latencies, 0.95);
    const p95Hit = percentile(hitLatencies, 0.95);
    const p95Miss = percentile(missLatencies, 0.95);

    const totalCost = logs.reduce((s, l) => s + l.cost + l.cost_saved, 0);
    const costReduction = totalCost > 0 ? (totalCostSaved / totalCost) * 100 : 0;

    let activeEntries = this.entries.length;
    if (tenantId && tenantId !== 'all') {
      activeEntries = this.entries.filter(e => e.tenant_id === tenantId).length;
    }

    return {
      total_requests: totalRequests,
      total_hits: totalHits,
      hit_rate: hitRate,
      total_cost_saved: totalCostSaved,
      p50_latency: p50,
      p95_latency: p95,
      p95_cache_hit_latency: p95Hit,
      p95_cache_miss_latency: p95Miss,
      total_tokens_saved: totalTokensSaved,
      active_cache_entries: activeEntries,
      cost_reduction_percent: costReduction,
    };
  }

  getTimeSeries(tenantId?: string, days: number = 30): TimeSeriesPoint[] {
    this.initialize();
    let logs = this.logs;
    if (tenantId && tenantId !== 'all') {
      logs = logs.filter(l => l.tenant_id === tenantId);
    }

    const points: TimeSeriesPoint[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let d = days - 1; d >= 0; d--) {
      const dayStart = new Date(now).getTime() - d * 24 * 60 * 60 * 1000;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const dayLogs = logs.filter(l => l.timestamp >= dayStart && l.timestamp < dayEnd);

      const requests = dayLogs.length;
      const hits = dayLogs.filter(l => l.cache_hit).length;
      const misses = requests - hits;
      const hitRate = requests > 0 ? hits / requests : 0;
      const costSaved = dayLogs.reduce((s, l) => s + l.cost_saved, 0);

      const dayLatencies = dayLogs.map(l => l.latency_ms).sort((a, b) => a - b);
      const pct = (arr: number[], p: number): number => {
        if (arr.length === 0) return 0;
        return arr[Math.min(Math.ceil(arr.length * p) - 1, arr.length - 1)] || 0;
      };

      const date = new Date(dayStart);
      points.push({
        timestamp: dayStart,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        requests,
        hits,
        misses,
        hit_rate: hitRate * 100,
        cost_saved: costSaved,
        p50_latency: pct(dayLatencies, 0.5),
        p95_latency: pct(dayLatencies, 0.95),
      });
    }

    return points;
  }
}

let storeInstance: SemanticCacheStore | null = null;

export function getCacheStore(): SemanticCacheStore {
  if (!storeInstance) {
    storeInstance = new SemanticCacheStore();
  }
  return storeInstance;
}
