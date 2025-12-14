/**
 * Email service using Resend
 * Handles all transactional emails for the Wisesama platform
 */
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

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
 * Email sent when a user submits a fraud report
 */
export async function sendReportConfirmation(params: {
  email: string;
  reportId: string;
  entityValue: string;
  entityType: string;
  threatCategory: string;
}): Promise<EmailResult> {
  const { email, reportId, entityValue, entityType, threatCategory } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Submitted - Wisesama</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #E6007A 0%, #7D3AED 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Wisesama</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Polkadot Ecosystem Security</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <h2 style="color: #1f2937; margin-top: 0;">Report Submitted Successfully</h2>

    <p style="color: #4b5563; line-height: 1.6;">
      Thank you for helping keep the Polkadot ecosystem safe. Your report has been received and will be reviewed by our team.
    </p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Report Details</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Report ID:</td>
          <td style="color: #1f2937; font-family: monospace;">${reportId.slice(0, 12)}...</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Entity:</td>
          <td style="color: #1f2937; font-family: monospace; word-break: break-all;">${entityValue}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Type:</td>
          <td style="color: #1f2937;">${entityType}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Category:</td>
          <td style="color: #dc2626; font-weight: 500;">${threatCategory.replace(/_/g, ' ')}</td>
        </tr>
      </table>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      <strong>What happens next?</strong><br>
      Our team will review your report and verify the information. If confirmed, the entity will be added to our threat database and may be contributed to the <a href="https://github.com/polkadot-js/phishing" style="color: #E6007A;">polkadot-js/phishing</a> repository.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      This email was sent by <a href="${APP_URL}" style="color: #E6007A;">Wisesama</a>. If you didn't submit this report, please ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Report Submitted Successfully

Thank you for helping keep the Polkadot ecosystem safe. Your report has been received and will be reviewed by our team.

Report Details:
- Report ID: ${reportId.slice(0, 12)}...
- Entity: ${entityValue}
- Type: ${entityType}
- Category: ${threatCategory.replace(/_/g, ' ')}

What happens next?
Our team will review your report and verify the information. If confirmed, the entity will be added to our threat database.

- Wisesama Team
  `.trim();

  return sendEmail({
    to: email,
    subject: `Report Submitted: ${entityType} - ${threatCategory.replace(/_/g, ' ')}`,
    html,
    text,
  });
}

/**
 * Email sent when a report is verified by admin
 */
export async function sendReportVerified(params: {
  email: string;
  reportId: string;
  entityValue: string;
  entityType: string;
  threatCategory: string;
  addedToBlacklist: boolean;
}): Promise<EmailResult> {
  const { email, reportId, entityValue, entityType, threatCategory, addedToBlacklist } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Verified - Wisesama</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Wisesama</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Polkadot Ecosystem Security</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="display: inline-block; background: #dcfce7; color: #059669; padding: 8px 16px; border-radius: 20px; font-weight: 500;">
        ✓ Verified
      </span>
    </div>

    <h2 style="color: #1f2937; margin-top: 0; text-align: center;">Your Report Has Been Verified!</h2>

    <p style="color: #4b5563; line-height: 1.6;">
      Great news! Your fraud report has been reviewed and verified by our team. Thank you for contributing to the security of the Polkadot ecosystem.
    </p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Verified Report</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Entity:</td>
          <td style="color: #1f2937; font-family: monospace; word-break: break-all;">${entityValue}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Type:</td>
          <td style="color: #1f2937;">${entityType}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Category:</td>
          <td style="color: #dc2626; font-weight: 500;">${threatCategory.replace(/_/g, ' ')}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Status:</td>
          <td style="color: #059669; font-weight: 500;">${addedToBlacklist ? 'Added to blocklist' : 'Verified'}</td>
        </tr>
      </table>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      ${addedToBlacklist
        ? 'This entity has been added to our threat database and will now be flagged when queried through our API.'
        : 'This report has been verified for community reference.'}
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      This email was sent by <a href="${APP_URL}" style="color: #E6007A;">Wisesama</a>.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Your Report Has Been Verified!

Great news! Your fraud report has been reviewed and verified by our team. Thank you for contributing to the security of the Polkadot ecosystem.

Verified Report:
- Entity: ${entityValue}
- Type: ${entityType}
- Category: ${threatCategory.replace(/_/g, ' ')}
- Status: ${addedToBlacklist ? 'Added to blocklist' : 'Verified'}

${addedToBlacklist
  ? 'This entity has been added to our threat database and will now be flagged when queried through our API.'
  : 'This report has been verified for community reference.'}

- Wisesama Team
  `.trim();

  return sendEmail({
    to: email,
    subject: `Report Verified: Your ${entityType} report has been confirmed`,
    html,
    text,
  });
}

/**
 * Email sent when a report is rejected by admin
 */
export async function sendReportRejected(params: {
  email: string;
  reportId: string;
  entityValue: string;
  entityType: string;
  reason: string;
}): Promise<EmailResult> {
  const { email, reportId, entityValue, entityType, reason } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Update - Wisesama</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Wisesama</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Polkadot Ecosystem Security</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <h2 style="color: #1f2937; margin-top: 0;">Report Review Update</h2>

    <p style="color: #4b5563; line-height: 1.6;">
      Thank you for your fraud report. After careful review, our team was unable to verify this report at this time.
    </p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Report Details</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Entity:</td>
          <td style="color: #1f2937; font-family: monospace; word-break: break-all;">${entityValue}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Type:</td>
          <td style="color: #1f2937;">${entityType}</td>
        </tr>
      </table>
    </div>

    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">Reason:</p>
      <p style="margin: 5px 0 0 0; color: #1f2937;">${reason}</p>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      If you have additional evidence or information, feel free to submit a new report with more details.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      This email was sent by <a href="${APP_URL}" style="color: #E6007A;">Wisesama</a>.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Report Review Update

Thank you for your fraud report. After careful review, our team was unable to verify this report at this time.

Report Details:
- Entity: ${entityValue}
- Type: ${entityType}

Reason: ${reason}

If you have additional evidence or information, feel free to submit a new report with more details.

- Wisesama Team
  `.trim();

  return sendEmail({
    to: email,
    subject: `Report Update: Your ${entityType} report has been reviewed`,
    html,
    text,
  });
}

/**
 * Admin alert when a new report is submitted
 */
export async function sendAdminNewReportAlert(params: {
  adminEmail: string;
  reportId: string;
  entityValue: string;
  entityType: string;
  threatCategory: string;
  reporterEmail?: string;
}): Promise<EmailResult> {
  const { adminEmail, reportId, entityValue, entityType, threatCategory, reporterEmail } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Report - Wisesama Admin</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: #1f2937; padding: 20px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 20px;">Wisesama Admin Alert</h1>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
      <strong style="color: #92400e;">New Report Submitted</strong>
      <p style="margin: 5px 0 0 0; color: #78350f;">A new fraud report requires review.</p>
    </div>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="color: #6b7280; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Report ID:</td>
        <td style="color: #1f2937; font-family: monospace; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${reportId}</td>
      </tr>
      <tr>
        <td style="color: #6b7280; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Entity:</td>
        <td style="color: #1f2937; font-family: monospace; word-break: break-all; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${entityValue}</td>
      </tr>
      <tr>
        <td style="color: #6b7280; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Type:</td>
        <td style="color: #1f2937; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${entityType}</td>
      </tr>
      <tr>
        <td style="color: #6b7280; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">Category:</td>
        <td style="color: #dc2626; font-weight: 500; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${threatCategory.replace(/_/g, ' ')}</td>
      </tr>
      ${reporterEmail ? `
      <tr>
        <td style="color: #6b7280; padding: 8px 0;">Reporter:</td>
        <td style="color: #1f2937; padding: 8px 0;">${reporterEmail}</td>
      </tr>
      ` : ''}
    </table>

    <div style="margin-top: 20px; text-align: center;">
      <a href="${APP_URL}/admin/reports/${reportId}" style="display: inline-block; background: #E6007A; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Review Report
      </a>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({
    to: adminEmail,
    subject: `[Wisesama] New ${threatCategory.replace(/_/g, ' ')} Report: ${entityType}`,
    html,
  });
}

/**
 * Email sent when a whitelist request is submitted
 */
export async function sendWhitelistRequestConfirmation(params: {
  email: string;
  requestId: string;
  entityValue: string;
  entityType: string;
  name: string;
}): Promise<EmailResult> {
  const { email, requestId, entityValue, entityType, name } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Whitelist Request Submitted - Wisesama</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #7D3AED 0%, #E6007A 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Wisesama</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Polkadot Ecosystem Security</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <h2 style="color: #1f2937; margin-top: 0;">Whitelist Request Received</h2>

    <p style="color: #4b5563; line-height: 1.6;">
      Thank you for submitting your whitelist request. Our team will review it and verify the information provided.
    </p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Request Details</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Request ID:</td>
          <td style="color: #1f2937; font-family: monospace;">${requestId.slice(0, 12)}...</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Name:</td>
          <td style="color: #1f2937; font-weight: 500;">${name}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Entity:</td>
          <td style="color: #1f2937; font-family: monospace; word-break: break-all;">${entityValue}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Type:</td>
          <td style="color: #1f2937;">${entityType}</td>
        </tr>
      </table>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      <strong>What happens next?</strong><br>
      Our team will verify your entity against on-chain data and other sources. If approved, your entity will be added to the Wisesama whitelist, helping protect users from impersonation.
    </p>

    <p style="color: #4b5563; line-height: 1.6;">
      You can check your request status at:<br>
      <a href="${APP_URL}/whitelist/request/status?id=${requestId}" style="color: #E6007A;">${APP_URL}/whitelist/request/status</a>
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      This email was sent by <a href="${APP_URL}" style="color: #E6007A;">Wisesama</a>. If you didn't submit this request, please ignore this email.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Whitelist Request Received

Thank you for submitting your whitelist request. Our team will review it and verify the information provided.

Request Details:
- Request ID: ${requestId.slice(0, 12)}...
- Name: ${name}
- Entity: ${entityValue}
- Type: ${entityType}

What happens next?
Our team will verify your entity against on-chain data and other sources. If approved, your entity will be added to the Wisesama whitelist.

Check your request status at: ${APP_URL}/whitelist/request/status?id=${requestId}

- Wisesama Team
  `.trim();

  return sendEmail({
    to: email,
    subject: `Whitelist Request Submitted: ${name}`,
    html,
    text,
  });
}

/**
 * Email sent when a whitelist request is approved
 */
export async function sendWhitelistRequestApproved(params: {
  email: string;
  requestId: string;
  entityValue: string;
  entityType: string;
  name: string;
}): Promise<EmailResult> {
  const { email, requestId, entityValue, entityType, name } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Whitelist Request Approved - Wisesama</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Wisesama</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Polkadot Ecosystem Security</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 20px;">
      <span style="display: inline-block; background: #dcfce7; color: #059669; padding: 8px 16px; border-radius: 20px; font-weight: 500;">
        &#10003; Approved
      </span>
    </div>

    <h2 style="color: #1f2937; margin-top: 0; text-align: center;">Your Whitelist Request Has Been Approved!</h2>

    <p style="color: #4b5563; line-height: 1.6;">
      Great news! Your whitelist request has been reviewed and approved. Your entity is now part of the Wisesama trusted whitelist.
    </p>

    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
      <p style="margin: 0 0 10px 0; color: #059669; font-weight: 500;">Whitelisted Entity</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Name:</td>
          <td style="color: #1f2937; font-weight: 500;">${name}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Entity:</td>
          <td style="color: #1f2937; font-family: monospace; word-break: break-all;">${entityValue}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Type:</td>
          <td style="color: #1f2937;">${entityType}</td>
        </tr>
      </table>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      <strong>What this means:</strong><br>
      When users search for your entity on Wisesama, it will be marked as trusted/verified, helping protect your identity from impersonation attempts.
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      This email was sent by <a href="${APP_URL}" style="color: #E6007A;">Wisesama</a>.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Your Whitelist Request Has Been Approved!

Great news! Your whitelist request has been reviewed and approved. Your entity is now part of the Wisesama trusted whitelist.

Whitelisted Entity:
- Name: ${name}
- Entity: ${entityValue}
- Type: ${entityType}

What this means:
When users search for your entity on Wisesama, it will be marked as trusted/verified, helping protect your identity from impersonation attempts.

- Wisesama Team
  `.trim();

  return sendEmail({
    to: email,
    subject: `Whitelist Approved: ${name} is now verified on Wisesama`,
    html,
    text,
  });
}

/**
 * Email sent when a whitelist request is rejected
 */
export async function sendWhitelistRequestRejected(params: {
  email: string;
  requestId: string;
  entityValue: string;
  entityType: string;
  name: string;
  reason: string;
}): Promise<EmailResult> {
  const { email, requestId, entityValue, entityType, name, reason } = params;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Whitelist Request Update - Wisesama</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: linear-gradient(135deg, #6b7280 0%, #9ca3af 100%); padding: 30px; border-radius: 12px 12px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Wisesama</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Polkadot Ecosystem Security</p>
  </div>

  <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <h2 style="color: #1f2937; margin-top: 0;">Whitelist Request Update</h2>

    <p style="color: #4b5563; line-height: 1.6;">
      Thank you for your whitelist request. After careful review, we were unable to approve it at this time.
    </p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Request Details</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Name:</td>
          <td style="color: #1f2937; font-weight: 500;">${name}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Entity:</td>
          <td style="color: #1f2937; font-family: monospace; word-break: break-all;">${entityValue}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Type:</td>
          <td style="color: #1f2937;">${entityType}</td>
        </tr>
      </table>
    </div>

    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">Reason:</p>
      <p style="margin: 5px 0 0 0; color: #1f2937;">${reason}</p>
    </div>

    <p style="color: #4b5563; line-height: 1.6;">
      If you believe this was in error or have additional verification evidence, you're welcome to submit a new request with more details.
    </p>

    <div style="margin-top: 20px; text-align: center;">
      <a href="${APP_URL}/whitelist/request" style="display: inline-block; background: #7D3AED; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Submit New Request
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      This email was sent by <a href="${APP_URL}" style="color: #E6007A;">Wisesama</a>.
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
Whitelist Request Update

Thank you for your whitelist request. After careful review, we were unable to approve it at this time.

Request Details:
- Name: ${name}
- Entity: ${entityValue}
- Type: ${entityType}

Reason: ${reason}

If you believe this was in error or have additional verification evidence, you're welcome to submit a new request with more details.

Submit a new request at: ${APP_URL}/whitelist/request

- Wisesama Team
  `.trim();

  return sendEmail({
    to: email,
    subject: `Whitelist Request Update: ${name}`,
    html,
    text,
  });
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
      Your API key <strong>"${keyName}"</strong> has reached <strong>${usagePercent}%</strong> of its monthly quota.
    </p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Key Name:</td>
          <td style="color: #1f2937; font-weight: 500;">${keyName}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Current Usage:</td>
          <td style="color: #1f2937;">${Math.round((limit * usagePercent) / 100).toLocaleString()} / ${limit.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="color: #6b7280; padding: 5px 0;">Status:</td>
          <td style="color: ${isExceeded ? '#DC2626' : '#F59E0B'}; font-weight: 500;">
            ${isExceeded ? 'Quota Exceeded' : 'Approaching Limit'}
          </td>
        </tr>
      </table>
    </div>

    ${isExceeded ? `
    <p style="color: #dc2626; line-height: 1.6;">
      <strong>Your API key has stopped working.</strong> Please upgrade your plan to increase your limits and restore service.
    </p>
    ` : `
    <p style="color: #4b5563; line-height: 1.6;">
      To ensure uninterrupted service, consider upgrading your plan or optimizing your usage.
    </p>
    `}

    <div style="margin-top: 25px; text-align: center;">
      <a href="${APP_URL}/dashboard" style="display: inline-block; background: #7D3AED; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
        Manage API Keys
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      This email was sent by <a href="${APP_URL}" style="color: #E6007A;">Wisesama</a>.
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
