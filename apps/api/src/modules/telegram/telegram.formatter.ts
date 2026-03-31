import type { CheckResponse } from '@wisesama/types';

const RISK_EMOJI: Record<string, string> = {
  SAFE: '🟢',
  LOW_RISK: '🟡',
  UNKNOWN: '⚪',
  CAUTION: '🟠',
  FRAUD: '🔴',
};

/** Escape special characters for Telegram MarkdownV2 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

export function formatCheckResponse(result: CheckResponse, appUrl: string): string {
  const risk = result.assessment;
  const emoji = RISK_EMOJI[risk.riskLevel] ?? '⚪';
  const score = risk.riskScore != null ? `${risk.riskScore}/100` : 'N/A';

  const lines: string[] = [
    `🔍 *Wisesama Risk Assessment*`,
    '',
    `*Entity:* \`${escapeMarkdown(result.entity)}\``,
    `*Type:* ${escapeMarkdown(result.entityType)}`,
    `*Risk:* ${emoji} ${escapeMarkdown(risk.riskLevel)} \\(${escapeMarkdown(score)}\\)`,
  ];

  if (risk.threatCategory) {
    lines.push(`*Threat:* ${escapeMarkdown(risk.threatCategory)}`);
  }

  // Identity info (addresses)
  if (result.identity?.hasIdentity) {
    lines.push('');
    const name = result.identity.displayName ?? 'Unknown';
    const verified = result.identity.isVerified ? '✅ Verified' : '❌ Unverified';
    lines.push(`*Identity:* ${escapeMarkdown(name)} \\(${escapeMarkdown(verified)}\\)`);
  }

  // Whitelist info
  if (result.whitelist?.found) {
    lines.push(`*Whitelisted:* ✅ ${escapeMarkdown(result.whitelist.name ?? 'Known entity')}`);
  }

  // Blacklist info
  if (result.blacklist?.found) {
    lines.push(`*Blacklisted:* 🚫 Source: ${escapeMarkdown(result.blacklist.source ?? 'polkadot-js/phishing')}`);
  }

  // Look-alike warning
  if (result.lookAlike?.isLookAlike) {
    lines.push('');
    lines.push(`⚠️ *Impersonation Warning:* Similar to ${escapeMarkdown(result.lookAlike.knownHandle ?? '')}`);
  }

  // Transaction summary (addresses)
  if (result.transactionSummary?.totalTransactions != null) {
    const ts = result.transactionSummary;
    lines.push('');
    lines.push(`*Transactions:* ${escapeMarkdown(String(ts.totalTransactions))}`);
    if (ts.currentBalance) {
      lines.push(`*Balance:* ${escapeMarkdown(ts.currentBalance)}`);
    }
  }

  // VirusTotal (domains)
  if (result.virusTotal) {
    lines.push('');
    lines.push(`*VirusTotal:* ${escapeMarkdown(result.virusTotal.verdict ?? 'unknown')} \\(${result.virusTotal.positives ?? 0}/${result.virusTotal.total ?? 0} engines\\)`);
  }

  // Full report link
  const encodedEntity = encodeURIComponent(result.entity);
  lines.push('');
  lines.push(`[View full report](${escapeMarkdown(appUrl)}/check/${escapeMarkdown(encodedEntity)})`);

  return lines.join('\n');
}

export function formatReportConfirmation(reportId: string): string {
  return `✅ *Report submitted\\!*\n\nID: \`${escapeMarkdown(reportId)}\`\nStatus: Pending review\n\nOur team will review this report\\. Thank you for keeping the ecosystem safe\\!`;
}

export function formatError(message: string): string {
  return `❌ ${escapeMarkdown(message)}`;
}

export function formatHelp(): string {
  return [
    '🛡️ *Wisesama Bot*',
    '',
    'Scan and report scams in the Polkadot ecosystem\\.',
    '',
    '*Commands:*',
    '`/check <entity>` \\- Check a wallet address, domain, or Twitter handle',
    '`/report <entity> <category> [description]` \\- Report a suspicious entity',
    '`/help` \\- Show this message',
    '',
    '*Categories:* phishing, scam, rug\\_pull, impersonation, fake\\_airdrop, ransomware, other',
    '',
    '*Examples:*',
    '`/check 16ZL8yLy...`',
    '`/check polkadot\\-claim\\.xyz`',
    '`/report scam\\-site\\.xyz phishing Fake airdrop`',
  ].join('\n');
}
