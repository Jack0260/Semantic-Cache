const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'need', 'shall', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about',
  'like', 'through', 'over', 'before', 'between', 'after', 'below',
  'above', 'up', 'down', 'out', 'off', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'but',
  'and', 'or', 'if', 'because', 'while', 'what', 'which', 'who', 'whom',
  'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you',
  'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them',
  'their', 'tell', 'me', 'about', 'give', 'let', 'know',
]);

const WORD_EMBEDDINGS: Record<string, number[]> = {};

const VOCAB: Record<string, number> = {
  refund: 0, policy: 1, return: 2, money: 3, back: 4, cancel: 5,
  subscription: 6, billing: 7, payment: 8, charge: 9, invoice: 10,
  pricing: 11, cost: 12, price: 13, plan: 14, upgrade: 15, downgrade: 16,
  account: 17, login: 18, password: 19, reset: 20, forgot: 21,
  shipping: 22, delivery: 23, track: 24, order: 25, status: 26,
  support: 27, help: 28, contact: 29, email: 30, phone: 31,
  warranty: 32, guarantee: 33, broken: 34, fix: 35, repair: 36,
  discount: 37, coupon: 38, promo: 39, code: 40, sale: 41,
  feature: 42, functionality: 43, how: 44, what: 45, why: 46,
  when: 47, where: 48, can: 49, do: 50, does: 51, will: 52,
  api: 53, key: 54, integration: 55, webhook: 56, documentation: 57,
  docs: 58, guide: 59, tutorial: 60, setup: 61, install: 62,
  error: 63, bug: 64, issue: 65, problem: 66, not: 67, working: 68,
  slow: 69, fast: 70, speed: 71, performance: 72, optimize: 73,
  security: 74, privacy: 75, data: 76, gdpr: 77, compliance: 78,
  team: 79, member: 80, invite: 81, user: 82, role: 83, permission: 84,
  limit: 85, quota: 86, rate: 87, throttle: 88, exceed: 89,
  change: 90, update: 91, modify: 92, delete: 93, remove: 94, add: 95,
  create: 96, new: 97, existing: 98, current: 99, previous: 100,
  available: 101, unavailable: 102, enabled: 103, disabled: 104,
  free: 105, premium: 106, pro: 107, enterprise: 108, basic: 109,
  trial: 110, expire: 111, renew: 112, auto: 113, manual: 114,
  report: 115, analytics: 116, dashboard: 117, metric: 118, export: 119,
  notify: 120, notification: 121, alert: 122, message: 123, send: 124,
  ai: 125, model: 126, gpt: 127, llm: 128, prompt: 129, response: 130,
  cache: 131, semantic: 132, similar: 133, match: 134, vector: 135,
  embedding: 136, similarity: 137, search: 138, query: 139, question: 140,
  answer: 141, bot: 142, chat: 143, conversation: 144, history: 145,
  session: 146, token: 147, usage: 148, credit: 149, balance: 150,
  start: 151, begin: 152, process: 153, step: 154, instruction: 155,
  requirement: 156, eligible: 157, qualify: 158, apply: 159, submit: 160,
  form: 161, fill: 162, complete: 163, verify: 164, verification: 165,
  confirm: 166, approval: 167, reject: 168, deny: 169, accept: 170,
  guideline: 171, term: 172, condition: 173, agreement: 174, legal: 175,
  tax: 176, fee: 177, surcharge: 178, total: 179, amount: 180,
  receipt: 181, statement: 182, transaction: 183, purchase: 184, buy: 185,
  checkout: 186, cart: 187, item: 188, product: 189, service: 190,
  feature_set: 191, capability: 192, limitation: 193, restrict: 194, allow: 195,
  access: 196, grant: 197, authorize: 198, authenticate: 199, secure: 200,
};

const EMBED_DIM = 256;

function wordToVector(word: string): number[] {
  if (WORD_EMBEDDINGS[word]) return WORD_EMBEDDINGS[word];

  const idx = VOCAB[word];
  const vec = new Array(EMBED_DIM).fill(0);

  if (idx !== undefined) {
    const base = idx % EMBED_DIM;
    vec[base] = 1.0;
    const secondary = (idx * 7 + 3) % EMBED_DIM;
    vec[secondary] = 0.5;
    const tertiary = (idx * 13 + 17) % EMBED_DIM;
    vec[tertiary] = 0.3;
  } else {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(i);
      hash = hash & 0x7fffffff;
    }
    for (let i = 0; i < EMBED_DIM; i++) {
      hash = ((hash * 31 + i * 7 + 13) % 9973) / 9973;
      vec[i] = (hash - 0.5) * 0.1;
    }
  }

  WORD_EMBEDDINGS[word] = vec;
  return vec;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

export function embed(text: string): number[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return new Array(EMBED_DIM).fill(0);

  const sum = new Array(EMBED_DIM).fill(0);
  for (const token of tokens) {
    const vec = wordToVector(token);
    for (let i = 0; i < EMBED_DIM; i++) {
      sum[i] += vec[i];
    }
  }

  const magnitude = Math.sqrt(sum.reduce((s, v) => s + v * v, 0));
  if (magnitude === 0) return new Array(EMBED_DIM).fill(0);

  return sum.map(v => v / magnitude);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}
