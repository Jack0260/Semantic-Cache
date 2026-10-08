import { CacheEntry, RequestLog, Tenant, CacheConfig, PIIScrubConfig } from './types';
import { embed } from './embeddings';
import { scrubPII } from './pii';

const DEFAULT_PII_CONFIG: PIIScrubConfig = {
  enabled: true,
  email: true,
  phone: true,
  ssn: true,
  credit_card: true,
};

export const DEFAULT_CONFIG: CacheConfig = {
  similarity_threshold: 0.92,
  cache_ttl_hours: 24,
  pii_config: DEFAULT_PII_CONFIG,
  default_model: 'gpt-4o',
};

export const DEFAULT_TENANTS: Tenant[] = [
  {
    id: 'tenant_acme',
    name: 'Acme Corp',
    api_key_hash: 'sk-acme-****-91af',
    similarity_threshold: 0.92,
    cache_ttl_hours: 24,
    total_requests: 0,
    total_hits: 0,
    total_cost_saved: 0,
    created_at: Date.now() - 30 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'tenant_globex',
    name: 'Globex Industries',
    api_key_hash: 'sk-globex-****-3c7e',
    similarity_threshold: 0.88,
    cache_ttl_hours: 48,
    total_requests: 0,
    total_hits: 0,
    total_cost_saved: 0,
    created_at: Date.now() - 20 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'tenant_initech',
    name: 'Initech LLC',
    api_key_hash: 'sk-initech-****-b2d4',
    similarity_threshold: 0.95,
    cache_ttl_hours: 12,
    total_requests: 0,
    total_hits: 0,
    total_cost_saved: 0,
    created_at: Date.now() - 15 * 24 * 60 * 60 * 1000,
  },
];

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

interface SeedQA {
  question: string;
  answer: string;
  model?: string;
  tenant_id: string;
  days_ago: number;
  hits: number;
}

const SEED_QAS: SeedQA[] = [
  {
    question: 'What is your refund policy?',
    answer: 'Our refund policy allows you to request a full refund within 30 days of purchase. After 30 days, partial refunds may be available depending on the circumstances. To request a refund, contact our billing team with your order number.',
    model: 'gpt-4o',
    tenant_id: 'tenant_acme',
    days_ago: 28,
    hits: 47,
  },
  {
    question: 'How do I reset my password?',
    answer: 'To reset your password, click the "Forgot Password" link on the login page. Enter your email address and we will send you a reset link. The link expires after 1 hour. If you do not receive the email, check your spam folder or contact support.',
    model: 'gpt-4o',
    tenant_id: 'tenant_acme',
    days_ago: 25,
    hits: 89,
  },
  {
    question: 'What pricing plans do you offer?',
    answer: 'We offer three pricing plans: Starter ($29/mo) for small teams, Pro ($99/mo) for growing businesses, and Enterprise (custom pricing) for large organizations. All plans include a 14-day free trial. You can upgrade or downgrade at any time.',
    model: 'gpt-4o',
    tenant_id: 'tenant_globex',
    days_ago: 20,
    hits: 62,
  },
  {
    question: 'How do I integrate with the API?',
    answer: 'You can integrate with our API by first generating an API key from your dashboard. Use the key in the Authorization header as a Bearer token. Our REST API supports JSON requests and responses. Full documentation is available at our docs site with code examples in Python, JavaScript, and Go.',
    model: 'gpt-4o',
    tenant_id: 'tenant_globex',
    days_ago: 18,
    hits: 34,
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time from your account settings. Cancellation takes effect at the end of your current billing cycle. You will retain access to all features until then. No cancellation fees apply.',
    model: 'gpt-4o-mini',
    tenant_id: 'tenant_acme',
    days_ago: 15,
    hits: 55,
  },
  {
    question: 'How does shipping work for orders?',
    answer: 'We offer free standard shipping on all orders over $50. Standard delivery takes 5-7 business days. Express shipping (2-3 business days) is available for $15. International shipping rates vary by destination. You will receive a tracking number via email once your order ships.',
    model: 'gpt-4o',
    tenant_id: 'tenant_initech',
    days_ago: 12,
    hits: 28,
  },
  {
    question: 'What is your data privacy policy?',
    answer: 'We take data privacy seriously. We are GDPR compliant and SOC 2 Type II certified. We do not sell your data to third parties. All data is encrypted at rest and in transit. You can request data deletion at any time by contacting our privacy team.',
    model: 'gpt-4o',
    tenant_id: 'tenant_initech',
    days_ago: 10,
    hits: 41,
  },
  {
    question: 'Do you offer discounts for nonprofits?',
    answer: 'Yes, we offer a 50% discount for registered nonprofit organizations. To apply, send us your 501(c)(3) documentation or equivalent to our sales team. The discount applies to all plans and is renewed annually upon verification.',
    model: 'gpt-4o-mini',
    tenant_id: 'tenant_globex',
    days_ago: 8,
    hits: 19,
  },
  {
    question: 'How do I upgrade my plan?',
    answer: 'To upgrade your plan, go to Settings > Billing in your dashboard. Select the plan you want to upgrade to and confirm. The upgrade takes effect immediately and you will be prorated the difference for the remaining billing cycle.',
    model: 'gpt-4o',
    tenant_id: 'tenant_acme',
    days_ago: 5,
    hits: 23,
  },
  {
    question: 'What happens when I exceed my API rate limit?',
    answer: 'When you exceed your API rate limit, requests will return a 429 Too Many Requests status code. You can upgrade your plan for higher limits or implement exponential backoff in your client code. Rate limit headers are included in every response to help you monitor usage.',
    model: 'gpt-4o',
    tenant_id: 'tenant_initech',
    days_ago: 3,
    hits: 12,
  },
];

const SEMANTIC_VARIATIONS: { original: string; variation: string }[] = [
  { original: 'What is your refund policy?', variation: 'Tell me about refunds' },
  { original: 'What is your refund policy?', variation: 'How do I get my money back?' },
  { original: 'How do I reset my password?', variation: 'I forgot my password, help' },
  { original: 'How do I reset my password?', variation: 'Password reset instructions' },
  { original: 'What pricing plans do you offer?', variation: 'How much does it cost?' },
  { original: 'What pricing plans do you offer?', variation: 'What are your subscription tiers?' },
  { original: 'How do I integrate with the API?', variation: 'API integration guide' },
  { original: 'Can I cancel my subscription anytime?', variation: 'How do I cancel my plan?' },
  { original: 'How does shipping work for orders?', variation: 'Delivery options and times' },
  { original: 'What is your data privacy policy?', variation: 'How do you handle my data?' },
  { original: 'Do you offer discounts for nonprofits?', variation: 'Nonprofit pricing available?' },
  { original: 'How do I upgrade my plan?', variation: 'Change to a higher tier' },
  { original: 'What happens when I exceed my API rate limit?', variation: 'API rate limit exceeded error' },
];

export function generateSeedData(): {
  entries: CacheEntry[];
  logs: RequestLog[];
  tenants: Tenant[];
} {
  const entries: CacheEntry[] = [];
  const logs: RequestLog[] = [];
  const tenants = DEFAULT_TENANTS.map(t => ({ ...t }));

  let entryId = 1;
  let logId = 1;

  for (const seed of SEED_QAS) {
    const createdAt = Date.now() - seed.days_ago * 24 * 60 * 60 * 1000;
    const inputTokens = estimateTokens(seed.question);
    const outputTokens = estimateTokens(seed.answer);
    const cost = estimateCost(seed.model || 'gpt-4o', inputTokens, outputTokens);
    const { scrubbed: qScrubbed, flags } = scrubPII(seed.question, DEFAULT_PII_CONFIG);
    const { scrubbed: aScrubbed } = scrubPII(seed.answer, DEFAULT_PII_CONFIG);

    const entry: CacheEntry = {
      id: `entry_${entryId++}`,
      tenant_id: seed.tenant_id,
      question: seed.question,
      question_scrubbed: qScrubbed,
      answer: seed.answer,
      answer_scrubbed: aScrubbed,
      embedding: embed(seed.question),
      model: seed.model || 'gpt-4o',
      tokens_saved: outputTokens,
      cost_saved: cost,
      hit_count: seed.hits,
      similarity_threshold: 0.92,
      created_at: createdAt,
      expires_at: createdAt + 24 * 60 * 60 * 1000,
      last_accessed: Date.now() - Math.floor(Math.random() * 24 * 60 * 60 * 1000),
      pii_flags: flags,
    };
    entries.push(entry);

    // Initial cache miss log
    logs.push({
      id: `log_${logId++}`,
      tenant_id: seed.tenant_id,
      question: seed.question,
      cache_hit: false,
      similarity_score: null,
      matched_entry_id: null,
      latency_ms: 1800 + Math.floor(Math.random() * 600),
      tokens: outputTokens,
      cost: cost,
      cost_saved: 0,
      model: seed.model || 'gpt-4o',
      pii_scrubbed: flags.length > 0,
      timestamp: createdAt,
    });

    const tenant = tenants.find(t => t.id === seed.tenant_id)!;
    tenant.total_requests += 1;
    tenant.total_cost_saved += cost * seed.hits;
  }

  // Generate cache hit logs from semantic variations + repeat queries
  for (const variation of SEMANTIC_VARIATIONS) {
    const originalEntry = entries.find(e => e.question === variation.original);
    if (!originalEntry) continue;

    const daysAgo = Math.floor(Math.random() * 20) + 1;
    const timestamp = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
    const latency = 30 + Math.floor(Math.random() * 25);

    logs.push({
      id: `log_${logId++}`,
      tenant_id: originalEntry.tenant_id,
      question: variation.variation,
      cache_hit: true,
      similarity_score: 0.92 + Math.random() * 0.07,
      matched_entry_id: originalEntry.id,
      latency_ms: latency,
      tokens: originalEntry.tokens_saved,
      cost: 0,
      cost_saved: originalEntry.cost_saved,
      model: originalEntry.model,
      pii_scrubbed: false,
      timestamp,
    });

    const tenant = tenants.find(t => t.id === originalEntry.tenant_id)!;
    tenant.total_requests += 1;
    tenant.total_hits += 1;
  }

  // Generate additional request logs over the past 30 days for charts
  for (let day = 29; day >= 0; day--) {
    const dayStart = Date.now() - day * 24 * 60 * 60 * 1000;
    const numRequests = 8 + Math.floor(Math.random() * 20);
    const hitRate = 0.45 + Math.random() * 0.3;

    for (let i = 0; i < numRequests; i++) {
      const isHit = Math.random() < hitRate;
      const tenant = tenants[Math.floor(Math.random() * tenants.length)];
      const timestamp = dayStart + Math.floor(Math.random() * 24 * 60 * 60 * 1000);

      if (isHit && entries.length > 0) {
        const entry = entries[Math.floor(Math.random() * entries.length)];
        const latency = 25 + Math.floor(Math.random() * 30);
        logs.push({
          id: `log_${logId++}`,
          tenant_id: tenant.id,
          question: entry.question,
          cache_hit: true,
          similarity_score: 0.9 + Math.random() * 0.09,
          matched_entry_id: entry.id,
          latency_ms: latency,
          tokens: entry.tokens_saved,
          cost: 0,
          cost_saved: entry.cost_saved,
          model: entry.model,
          pii_scrubbed: false,
          timestamp,
        });
        tenant.total_requests += 1;
        tenant.total_hits += 1;
        tenant.total_cost_saved += entry.cost_saved;
      } else {
        const latency = 1500 + Math.floor(Math.random() * 1200);
        const tokens = 50 + Math.floor(Math.random() * 300);
        const cost = estimateCost('gpt-4o', 20, tokens);
        const sampleQuestions = [
          'What features are included in the pro plan?',
          'How do I set up two-factor authentication?',
          'Can I export my data?',
          'What are the system requirements?',
          'How do I add a team member?',
          'Is there a mobile app available?',
          'What languages are supported?',
          'How do I generate a report?',
        ];
        logs.push({
          id: `log_${logId++}`,
          tenant_id: tenant.id,
          question: sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)],
          cache_hit: false,
          similarity_score: null,
          matched_entry_id: null,
          latency_ms: latency,
          tokens,
          cost,
          cost_saved: 0,
          model: 'gpt-4o',
          pii_scrubbed: Math.random() > 0.8,
          timestamp,
        });
        tenant.total_requests += 1;
      }
    }
  }

  logs.sort((a, b) => b.timestamp - a.timestamp);

  return { entries, logs, tenants };
}
