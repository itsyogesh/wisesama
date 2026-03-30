import type { CheckResponse } from '@wisesama/types';

const RISK_EMOJI: Record<string, string> = {
  SAFE: '🟢',
  LOW_RISK: '🟡',
  UNKNOWN: '⚪',
  CAUTION: '🟠',
  FRAUD: '🔴',
};

const APP_URL = process.env.APP_URL || 'https://wisesama.com';

/**
 * Format a risk assessment as a tweet reply (280 char limit).
 */
export function formatCheckTweet(result: CheckResponse): string {
  const risk = result.assessment;
  const emoji = RISK_EMOJI[risk.riskLevel] ?? '⚪';
  const score = risk.riskScore != null ? `${risk.riskScore}/100` : 'N/A';
  const entityShort = truncateEntity(result.entity, 20);
  const encodedEntity = encodeURIComponent(result.entity);

  const lines: string[] = [
    `🔍 Risk Assessment for ${entityShort}`,
    '',
    `${emoji} ${risk.riskLevel} (${score})`,
  ];

  if (risk.threatCategory) {
    lines.push(`Threat: ${risk.threatCategory}`);
  }

  if (result.identity?.hasIdentity) {
    const name = result.identity.displayName ?? 'Unknown';
    const verified = result.identity.isVerified ? '✅' : '❌';
    lines.push(`Identity: ${verified} ${name}`);
  }

  if (result.whitelist?.found) {
    lines.push(`Whitelisted: ✅ ${result.whitelist.name ?? 'Known'}`);
  }

  if (result.blacklist?.found) {
    lines.push(`Blacklisted: 🚫`);
  }

  if (result.lookAlike?.isLookAlike) {
    lines.push(`⚠️ May impersonate ${result.lookAlike.knownHandle ?? 'known handle'}`);
  }

  if (result.transactionSummary?.totalTransactions != null) {
    lines.push(`Txns: ${result.transactionSummary.totalTransactions}`);
  }

  lines.push('');
  lines.push(`Full report → ${APP_URL}/check/${encodedEntity}`);

  let tweet = lines.join('\n');

  // Trim to 280 chars
  if (tweet.length > 280) {
    const linkLine = `\n\nFull report → ${APP_URL}/check/${encodedEntity}`;
    const available = 280 - linkLine.length;
    const content = lines.slice(0, -2).join('\n');
    tweet = content.substring(0, available) + linkLine;
  }

  return tweet;
}

export function formatReportTweet(entity: string, reportId: string, author: string): string {
  return `🚨 Report received! Looking into ${truncateEntity(entity, 30)}.\n\nThanks for keeping the ecosystem safe, @${author}!\n\nTrack: ${APP_URL}`;
}

export function formatAlertTweet(entity: string, entityType: string, threatCategory: string): string {
  return [
    `🚨 Confirmed scam in the Polkadot ecosystem:`,
    '',
    `Entity: ${truncateEntity(entity, 40)}`,
    `Type: ${threatCategory}`,
    '',
    `Detected by community reports.`,
    `Check any address or domain → ${APP_URL}`,
  ].join('\n');
}

function truncateEntity(entity: string, maxLen: number): string {
  if (entity.length <= maxLen) return entity;
  return entity.substring(0, maxLen - 3) + '...';
}
