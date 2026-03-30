import { sendMessageToChannel } from '../modules/telegram/telegram.service';
import { formatAlertEmbed } from '../modules/discord/discord.formatter';
import { formatAlertTweet } from '../modules/twitter/twitter.formatter';
import { postTweet, canPostAlert, incrementAlertCount } from '../modules/twitter/twitter.service';

interface VerifiedReport {
  entityValue: string;
  entityType: string;
  threatCategory: string;
  riskScore: number;
}

/**
 * Broadcast a verified scam report to all configured channels.
 * Called from admin report verification flow.
 * Each channel is best-effort — failures don't block the others.
 */
export async function broadcastVerifiedReport(report: VerifiedReport): Promise<{
  discord: boolean;
  telegram: boolean;
  twitter: boolean;
}> {
  const results = { discord: false, telegram: false, twitter: false };

  // 1. Discord — Incoming Webhook
  const discordWebhookUrl = process.env.DISCORD_ALERT_WEBHOOK_URL;
  if (discordWebhookUrl) {
    try {
      const embed = formatAlertEmbed(
        report.entityValue,
        report.entityType,
        report.threatCategory,
        report.riskScore
      );

      const response = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
      });

      results.discord = response.ok;
      if (!response.ok) {
        console.error('[Alert] Discord webhook failed:', response.status, await response.text());
      }
    } catch (err) {
      console.error('[Alert] Discord webhook error:', err);
    }
  }

  // 2. Telegram — Bot API to channel
  const telegramChannelId = process.env.TELEGRAM_ALERT_CHANNEL_ID;
  if (telegramChannelId && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      // Simple escaped message for Telegram
      const entity = report.entityValue.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
      const text = [
        '🚨 *New Confirmed Scam*',
        '',
        `*Entity:* \`${entity}\``,
        `*Type:* ${report.entityType.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1')}`,
        `*Threat:* ${report.threatCategory.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1')}`,
        `*Risk:* 🔴 FRAUD \\(${report.riskScore}/100\\)`,
        '',
        'Detected by Wisesama \\+ community reports\\.',
      ].join('\n');

      await sendMessageToChannel(telegramChannelId, text);
      results.telegram = true;
    } catch (err) {
      console.error('[Alert] Telegram alert error:', err);
    }
  }

  // 3. X/Twitter — Post tweet (rate limited to 3/day)
  if (process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN) {
    try {
      if (await canPostAlert()) {
        const tweetText = formatAlertTweet(
          report.entityValue,
          report.entityType,
          report.threatCategory
        );

        results.twitter = await postTweet(tweetText);
        if (results.twitter) {
          await incrementAlertCount();
        }
      }
    } catch (err) {
      console.error('[Alert] Twitter alert error:', err);
    }
  }

  return results;
}
