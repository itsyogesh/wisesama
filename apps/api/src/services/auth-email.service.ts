import { sendBrevoEmail, usesBrevo } from './brevo-email.service';
import { verificationEmail } from './workspace-email-template';

/** Authentication email must fail visibly when delivery is unavailable. */
export async function sendAuthenticationEmail(input: {
  email: string;
  url: string;
}): Promise<void> {
  const template = verificationEmail(input.url);
  if (usesBrevo()) {
    const result = await sendBrevoEmail({ to: input.email, ...template });
    if (result.status !== 'sent') throw new Error(result.error);
    return;
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('Email verification is not configured. Contact support.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Wisesama <noreply@wisesama.com>',
      to: [input.email],
      ...template,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok)
    throw new Error('Verification email could not be sent. Please try again later.');
  const result = (await response.json()) as { id?: unknown };
  if (typeof result.id !== 'string' || !result.id) {
    throw new Error('Email delivery was not confirmed. Please try again later.');
  }
}
