/**
 * Email service using Resend
 * Shared API-key usage notifications for the API host
 */
import { Resend } from 'resend';
import { escapeHtml } from '../utils/escape-html';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Wisesama <noreply@wisesama.com>';
const APP_URL = process.env.APP_URL || 'https://wisesama.com';

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email with graceful fallback when Resend is not configured
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<EmailResult> {
  if (!resend) {
    console.log(`[Email] Resend not configured. Would send to ${params.to}: ${params.subject}`);
    return { success: true, messageId: 'mock-' + Date.now() };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      console.error('[Email] Failed to send:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Email] Error:', message);
    return { success: false, error: message };
  }
}

/**
 * Email sent when an API key reaches usage threshold
 */
export async function sendApiKeyAlert(params: {
  email: string;
  keyName: string;
  usagePercent: number;
  limit: number;
}): Promise<EmailResult> {
  const { email, keyName, usagePercent, limit } = params;
  const isExceeded = usagePercent >= 100;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Usage Alert - Wisesama</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, ${isExceeded ? '#DC2626' : '#F59E0B'} 0%, ${isExceeded ? '#B91C1C' : '#D97706'} 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Wisesama</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">API Usage Alert</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <h2 style="color: #1f2937; margin-top: 0;">API Key Usage Alert</h2>

    <p style="color: #4b5563; line-height: 1.6;">
      Your API key <strong>"${escapeHtml(keyName)}"</strong> has reached <strong>${escapeHtml(usagePercent)}%</strong> of its monthly quota.
    </p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Key Name:</td>
          <td style="color: #1f2937; font-weight: 500;">${escapeHtml(keyName)}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Current Usage:</td>
          <td style="color: #1f2937;">${escapeHtml(Math.round((limit * usagePercent) / 100).toLocaleString())} / ${escapeHtml(limit.toLocaleString())}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Status:</td>
          <td style="color: ${isExceeded ? '#DC2626' : '#F59E0B'}; font-weight: 500;">
            ${isExceeded ? 'Quota Exceeded' : 'Approaching Limit'}
          </td>
        </tr>
      </table>
    </div>

    ${
      isExceeded
        ? `
    <p style="color: #dc2626; line-height: 1.6;">
      <strong>Your API key has stopped working.</strong> Please upgrade your plan to increase your limits and restore service.
    </p>
    `
        : `
    <p style="color: #4b5563; line-height: 1.6;">
      To ensure uninterrupted service, consider upgrading your plan or optimizing your usage.
    </p>
    `
    }

    <div style="margin-top: 25px; text-align: center;">
      <a href="${escapeHtml(`${APP_URL}/dashboard`)}" style="display: inline-block; background: #7D3AED; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Manage API Keys
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      This email was sent by <a href="${escapeHtml(APP_URL)}" style="color: #E6007A;">Wisesama</a>.
    </p>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: email,
    subject: `[Alert] API Key Usage at ${usagePercent}%: ${keyName}`,
    html,
  });
}
