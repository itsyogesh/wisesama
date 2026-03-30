import type { CheckResponse } from '@wisesama/types';

const RISK_COLOR: Record<string, number> = {
  SAFE: 0x22c55e,      // green
  LOW_RISK: 0xeab308,  // yellow
  UNKNOWN: 0x9ca3af,   // gray
  CAUTION: 0xf97316,   // orange
  FRAUD: 0xef4444,     // red
};

const RISK_EMOJI: Record<string, string> = {
  SAFE: '🟢',
  LOW_RISK: '🟡',
  UNKNOWN: '⚪',
  CAUTION: '🟠',
  FRAUD: '🔴',
};

interface DiscordEmbed {
  title: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  url?: string;
  footer?: { text: string };
  timestamp?: string;
}

export function formatCheckEmbed(result: CheckResponse, appUrl: string): DiscordEmbed {
  const risk = result.assessment;
  const emoji = RISK_EMOJI[risk.riskLevel] ?? '⚪';
  const score = risk.riskScore != null ? `${risk.riskScore}/100` : 'N/A';
  const color = RISK_COLOR[risk.riskLevel] ?? 0x9ca3af;
  const encodedEntity = encodeURIComponent(result.entity);

  const fields: DiscordEmbed['fields'] = [
    { name: 'Entity', value: `\`${result.entity}\``, inline: true },
    { name: 'Type', value: result.entityType, inline: true },
    { name: 'Risk', value: `${emoji} ${risk.riskLevel} (${score})`, inline: true },
  ];

  if (risk.threatCategory) {
    fields.push({ name: 'Threat', value: risk.threatCategory, inline: true });
  }

  if (result.whitelist?.found) {
    fields.push({ name: 'Whitelisted', value: `✅ ${result.whitelist.name ?? 'Known entity'}`, inline: true });
  }

  if (result.blacklist?.found) {
    fields.push({ name: 'Blacklisted', value: `🚫 ${result.blacklist.source ?? 'polkadot-js/phishing'}`, inline: true });
  }

  if (result.identity?.hasIdentity) {
    const name = result.identity.displayName ?? 'Unknown';
    const verified = result.identity.isVerified ? '✅ Verified' : '❌ Unverified';
    fields.push({ name: 'Identity', value: `${name} (${verified})`, inline: true });
  }

  if (result.lookAlike?.isLookAlike) {
    fields.push({
      name: '⚠️ Impersonation Warning',
      value: `Similar to ${result.lookAlike.knownHandle ?? 'a known handle'} (${Math.round((result.lookAlike.similarity ?? 0) * 100)}% match)`,
    });
  }

  if (result.transactionSummary?.totalTransactions != null) {
    const ts = result.transactionSummary;
    const parts = [`Txns: ${ts.totalTransactions}`];
    if (ts.currentBalance) parts.push(`Balance: ${ts.currentBalance}`);
    fields.push({ name: 'On-Chain', value: parts.join(' | '), inline: true });
  }

  if (result.virusTotal) {
    fields.push({
      name: 'VirusTotal',
      value: `${result.virusTotal.verdict ?? 'unknown'} (${result.virusTotal.positives ?? 0}/${result.virusTotal.total ?? 0} engines)`,
      inline: true,
    });
  }

  return {
    title: '🔍 Wisesama Risk Assessment',
    color,
    fields,
    url: `${appUrl}/check/${encodedEntity}`,
    footer: { text: 'wisesama.com' },
    timestamp: new Date().toISOString(),
  };
}

export function formatReportEmbed(reportId: string): DiscordEmbed {
  return {
    title: '✅ Report Submitted',
    color: 0x22c55e,
    fields: [
      { name: 'Report ID', value: `\`${reportId}\``, inline: true },
      { name: 'Status', value: 'Pending Review', inline: true },
    ],
    footer: { text: 'Thank you for keeping the ecosystem safe!' },
  };
}

export function formatAlertEmbed(entity: string, entityType: string, threatCategory: string, riskScore: number): DiscordEmbed {
  return {
    title: '🚨 New Confirmed Scam',
    color: 0xef4444,
    fields: [
      { name: 'Entity', value: `\`${entity}\``, inline: true },
      { name: 'Type', value: entityType, inline: true },
      { name: 'Threat', value: threatCategory, inline: true },
      { name: 'Risk', value: `🔴 FRAUD (${riskScore}/100)`, inline: true },
    ],
    footer: { text: 'Detected by Wisesama + community reports' },
    timestamp: new Date().toISOString(),
  };
}

export function formatHelpEmbed(): DiscordEmbed {
  return {
    title: '🛡️ Wisesama Bot',
    color: 0x8b5cf6,
    fields: [
      {
        name: 'Commands',
        value: [
          '`/check <entity>` — Check a wallet, domain, or handle for fraud risk',
          '`/report <entity> <category> [description]` — Report a suspicious entity',
          '`/help` — Show this message',
        ].join('\n'),
      },
      {
        name: 'Categories',
        value: 'phishing, scam, rug_pull, impersonation, fake_airdrop, ransomware, other',
      },
      {
        name: 'Examples',
        value: [
          '`/check 16ZL8yLyXv3V3L3z9ofR1ovFLziyXaN1DPq4yffMAZ9c`',
          '`/check polkadot-claim.xyz`',
          '`/report scam-site.xyz phishing Fake airdrop`',
        ].join('\n'),
      },
    ],
    footer: { text: 'wisesama.com' },
  };
}
