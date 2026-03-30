import type { ThreatCategory, EntityType } from '@wisesama/types';
import { prisma } from '@wisesama/database';
import { QueryService } from '../../services/query.service';
import { detectEntityType } from '../../utils/entity-detector';
import { formatCheckEmbed, formatReportEmbed, formatHelpEmbed } from './discord.formatter';

const queryService = new QueryService();

const THREAT_CATEGORIES: Record<string, ThreatCategory> = {
  phishing: 'PHISHING',
  scam: 'SCAM',
  rug_pull: 'RUG_PULL',
  impersonation: 'IMPERSONATION',
  fake_airdrop: 'FAKE_AIRDROP',
  ransomware: 'RANSOMWARE',
  other: 'OTHER',
};

// Discord interaction response types
const RESPONSE_TYPE = {
  PONG: 1,
  CHANNEL_MESSAGE: 4,
  DEFERRED_CHANNEL_MESSAGE: 5,
} as const;

const APP_URL = process.env.APP_URL || 'https://wisesama.com';

interface InteractionOption {
  name: string;
  value: string;
}

export interface InteractionResponse {
  type: number;
  data?: {
    content?: string;
    embeds?: unknown[];
    flags?: number;
  };
}

export async function handleCheckCommand(options: InteractionOption[], interactionToken: string, appId: string): Promise<void> {
  const entity = options.find((o) => o.name === 'entity')?.value;
  if (!entity) {
    await editDeferredResponse(appId, interactionToken, {
      content: '❌ Please provide an entity to check.',
    });
    return;
  }

  try {
    const result = await queryService.checkEntity(entity);
    const embed = formatCheckEmbed(result, APP_URL);

    await editDeferredResponse(appId, interactionToken, {
      embeds: [embed],
    });
  } catch (err) {
    console.error('[Discord] Check failed:', err);
    await editDeferredResponse(appId, interactionToken, {
      content: '❌ Failed to check this entity. Please try again later or visit wisesama.com directly.',
    });
  }
}

export async function handleReportCommand(options: InteractionOption[], interactionToken: string, appId: string, username?: string): Promise<void> {
  const entity = options.find((o) => o.name === 'entity')?.value;
  const category = options.find((o) => o.name === 'category')?.value?.toLowerCase();
  const description = options.find((o) => o.name === 'description')?.value;

  if (!entity || !category) {
    await editDeferredResponse(appId, interactionToken, {
      content: '❌ Entity and category are required.',
    });
    return;
  }

  const threatCategory = THREAT_CATEGORIES[category];
  if (!threatCategory) {
    await editDeferredResponse(appId, interactionToken, {
      content: `❌ Unknown category "${category}". Valid: phishing, scam, rug_pull, impersonation, fake_airdrop, ransomware, other`,
    });
    return;
  }

  try {
    const { type: entityType } = detectEntityType(entity);
    const reporterName = username ? `Discord: ${username}` : 'Discord user';

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

    const embed = formatReportEmbed(report.id);
    await editDeferredResponse(appId, interactionToken, {
      embeds: [embed],
    });
  } catch (err) {
    console.error('[Discord] Report failed:', err);
    await editDeferredResponse(appId, interactionToken, {
      content: '❌ Failed to submit report. Please try again later or report at wisesama.com/report.',
    });
  }
}

export function handleHelpCommand(): InteractionResponse {
  const embed = formatHelpEmbed();
  return {
    type: RESPONSE_TYPE.CHANNEL_MESSAGE,
    data: { embeds: [embed] },
  };
}

export function createDeferredResponse(ephemeral = false): InteractionResponse {
  return {
    type: RESPONSE_TYPE.DEFERRED_CHANNEL_MESSAGE,
    data: ephemeral ? { flags: 64 } : undefined,
  };
}

async function editDeferredResponse(appId: string, token: string, data: { content?: string; embeds?: unknown[] }): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Discord] editDeferredResponse failed:', response.status, error);
  }
}
