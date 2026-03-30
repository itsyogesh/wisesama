import type { ThreatCategory, EntityType } from '@wisesama/types';
import { prisma } from '@wisesama/database';
import { QueryService } from '../../services/query.service';
import { detectEntityType } from '../../utils/entity-detector';
import { formatCheckResponse, formatReportConfirmation, formatError, formatHelp } from './telegram.formatter';

const queryService = new QueryService();

const THREAT_CATEGORIES: Record<string, ThreatCategory> = {
  phishing: 'PHISHING',
  scam: 'SCAM',
  rug_pull: 'RUG_PULL',
  rugpull: 'RUG_PULL',
  impersonation: 'IMPERSONATION',
  fake_airdrop: 'FAKE_AIRDROP',
  fakeairdrop: 'FAKE_AIRDROP',
  ransomware: 'RANSOMWARE',
  mixer: 'MIXER',
  other: 'OTHER',
};

export interface CommandResult {
  text: string;
  parseMode: 'MarkdownV2';
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; url: string }>>;
  };
}

const APP_URL = process.env.APP_URL || 'https://wisesama.com';

export async function handleCheck(args: string): Promise<CommandResult> {
  const entity = args.trim();
  if (!entity) {
    return {
      text: formatError('Please provide an entity to check. Usage: /check <address|domain|handle>'),
      parseMode: 'MarkdownV2',
    };
  }

  try {
    const result = await queryService.checkEntity(entity);
    const encodedEntity = encodeURIComponent(entity);

    return {
      text: formatCheckResponse(result, APP_URL),
      parseMode: 'MarkdownV2',
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '🔍 Full Report', url: `${APP_URL}/check/${encodedEntity}` },
            { text: '🚨 Report Scam', url: `${APP_URL}/report` },
          ],
        ],
      },
    };
  } catch (err) {
    console.error('[Telegram] Check failed:', err);
    return {
      text: formatError('Failed to check this entity. Please try again later or visit wisesama.com directly.'),
      parseMode: 'MarkdownV2',
    };
  }
}

export async function handleReport(args: string, reporterUsername?: string): Promise<CommandResult> {
  const parts = args.trim().split(/\s+/);
  const entity = parts[0];
  const categoryInput = parts[1]?.toLowerCase();
  const description = parts.slice(2).join(' ') || undefined;

  if (!entity || !categoryInput) {
    return {
      text: formatError('Usage: /report <entity> <category> [description]\n\nCategories: phishing, scam, rug_pull, impersonation, fake_airdrop, ransomware, other'),
      parseMode: 'MarkdownV2',
    };
  }

  const threatCategory = THREAT_CATEGORIES[categoryInput];
  if (!threatCategory) {
    return {
      text: formatError(`Unknown category "${categoryInput}". Valid: phishing, scam, rug_pull, impersonation, fake_airdrop, ransomware, other`),
      parseMode: 'MarkdownV2',
    };
  }

  try {
    const { type: entityType } = detectEntityType(entity);
    const reporterName = reporterUsername ? `Telegram: @${reporterUsername}` : 'Telegram user';

    const report = await prisma.report.create({
      data: {
        reportedValue: entity,
        entityType: entityType as EntityType,
        threatCategory,
        description,
        reporterName,
        status: 'pending',
        evidenceUrls: [],
      },
    });

    return {
      text: formatReportConfirmation(report.id),
      parseMode: 'MarkdownV2',
    };
  } catch (err) {
    console.error('[Telegram] Report failed:', err);
    return {
      text: formatError('Failed to submit report. Please try again later or report at wisesama.com/report.'),
      parseMode: 'MarkdownV2',
    };
  }
}

export function handleHelp(): CommandResult {
  return {
    text: formatHelp(),
    parseMode: 'MarkdownV2',
  };
}
