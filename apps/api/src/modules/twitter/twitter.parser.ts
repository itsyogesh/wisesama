export interface ParsedMention {
  entities: string[];
  intent: 'CHECK' | 'REPORT';
}

// SS58 address pattern (Polkadot/Kusama/Substrate)
const SS58_REGEX = /\b[1-9A-HJ-NP-Za-km-z]{46,48}\b/g;

// Domain pattern
const DOMAIN_REGEX = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)*\.[a-zA-Z]{2,})/g;

// Twitter handle (exclude @wisesama_help itself)
const HANDLE_REGEX = /@([a-zA-Z0-9_]{1,15})\b/g;

const REPORT_KEYWORDS = ['scam', 'report', 'fraud', 'phishing', 'fake', 'impersonation', 'rug', 'rugpull', 'alert'];
const CHECK_KEYWORDS = ['check', 'scan', 'safe', 'verify', 'lookup', 'look up', 'is this'];

const EXCLUDED_HANDLES = new Set(['wisesama_help', 'wisesama']);

export function parseMention(text: string): ParsedMention | null {
  const entities: string[] = [];

  // Extract SS58 addresses
  const addresses = text.match(SS58_REGEX);
  if (addresses) {
    entities.push(...addresses);
  }

  // Extract domains (skip common ones like twitter.com, x.com, wisesama.com)
  const domainMatches = [...text.matchAll(DOMAIN_REGEX)];
  for (const match of domainMatches) {
    const domain = match[1]!.toLowerCase();
    if (!isExcludedDomain(domain)) {
      entities.push(domain);
    }
  }

  // Extract Twitter handles
  const handleMatches = [...text.matchAll(HANDLE_REGEX)];
  for (const match of handleMatches) {
    const handle = match[1]!.toLowerCase();
    if (!EXCLUDED_HANDLES.has(handle)) {
      entities.push(`@${handle}`);
    }
  }

  if (entities.length === 0) return null;

  // Determine intent
  const lowerText = text.toLowerCase();
  const hasReportKeyword = REPORT_KEYWORDS.some((kw) => lowerText.includes(kw));
  const hasCheckKeyword = CHECK_KEYWORDS.some((kw) => lowerText.includes(kw));

  // Default to CHECK unless report keywords are present without check keywords
  const intent = hasReportKeyword && !hasCheckKeyword ? 'REPORT' : 'CHECK';

  return { entities, intent };
}

function isExcludedDomain(domain: string): boolean {
  const excluded = [
    'twitter.com', 'x.com', 't.co',
    'wisesama.com', 'www.wisesama.com',
    'polkadot.network', 'polkadot.io',
    'subscan.io',
    'github.com',
    'youtube.com', 'youtu.be',
    'discord.gg', 'discord.com',
    'telegram.org', 't.me',
    'medium.com',
    'reddit.com',
  ];
  return excluded.some((ex) => domain === ex || domain.endsWith(`.${ex}`));
}
