import { PIIFlag, PIIScrubConfig } from './types';

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_REGEX = /\b(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

export function detectPII(text: string): PIIFlag[] {
  const flags: PIIFlag[] = [];
  let m: RegExpExecArray | null;

  EMAIL_REGEX.lastIndex = 0;
  while ((m = EMAIL_REGEX.exec(text)) !== null) {
    flags.push({ type: 'email', original: m[0], masked: maskValue(m[0]) });
  }
  SSN_REGEX.lastIndex = 0;
  while ((m = SSN_REGEX.exec(text)) !== null) {
    flags.push({ type: 'ssn', original: m[0], masked: maskValue(m[0]) });
  }
  CREDIT_CARD_REGEX.lastIndex = 0;
  while ((m = CREDIT_CARD_REGEX.exec(text)) !== null) {
    const digits = m[0].replace(/[^0-9]/g, '');
    if (digits.length >= 13 && digits.length <= 16 && luhnCheck(digits)) {
      flags.push({ type: 'credit_card', original: m[0], masked: maskValue(m[0]) });
    }
  }
  PHONE_REGEX.lastIndex = 0;
  while ((m = PHONE_REGEX.exec(text)) !== null) {
    const digits = m[0].replace(/[^0-9]/g, '');
    if (digits.length === 10 || digits.length === 11) {
      flags.push({ type: 'phone', original: m[0], masked: maskValue(m[0]) });
    }
  }

  return flags;
}

function maskValue(value: string): string {
  const len = value.length;
  if (len <= 4) return '****';
  return value.slice(0, 2) + '*'.repeat(Math.max(4, len - 4)) + value.slice(-2);
}

function luhnCheck(num: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = parseInt(num[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function scrubPII(text: string, config: PIIScrubConfig): { scrubbed: string; flags: PIIFlag[] } {
  if (!config.enabled) return { scrubbed: text, flags: [] };

  const allFlags = detectPII(text);
  const activeFlags = allFlags.filter(f => {
    if (f.type === 'email') return config.email;
    if (f.type === 'phone') return config.phone;
    if (f.type === 'ssn') return config.ssn;
    if (f.type === 'credit_card') return config.credit_card;
    return false;
  });

  let result = text;
  for (const flag of activeFlags) {
    result = result.replace(flag.original, flag.masked);
  }

  return { scrubbed: result, flags: activeFlags };
}
