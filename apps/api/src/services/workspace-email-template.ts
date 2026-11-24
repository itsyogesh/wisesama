type Action = { label: string; href: string };
type Email = { subject: string; text: string; html: string };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character]!;
  });
}

function safeHref(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? escapeHtml(url.href)
      : '';
  } catch {
    return '';
  }
}

function renderEmail(input: {
  subject: string;
  title: string;
  preheader: string;
  paragraphs: string[];
  action?: Action;
  footer: string;
  secondary?: Action;
}): Email {
  const { title, paragraphs, action, footer, secondary } = input;
  const actionUrl = action ? safeHref(action.href) : '';
  const secondaryUrl = secondary ? safeHref(secondary.href) : '';
  const paragraphHtml = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#35303f;font-size:16px;line-height:1.55;overflow-wrap:anywhere">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
  const button =
    actionUrl && action
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr><td bgcolor="#6535ac" style="border-radius:8px"><a href="${actionUrl}" style="display:inline-block;padding:13px 20px;border:1px solid #6535ac;border-radius:8px;background-color:#6535ac;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">${escapeHtml(action.label)}</a></td></tr></table>`
      : '';
  return {
    subject: input.subject,
    text: [
      title,
      ...paragraphs,
      ...(actionUrl && action ? [`${action.label}: ${action.href}`] : []),
      footer,
      ...(secondaryUrl && secondary ? [`${secondary.label}: ${secondary.href}`] : []),
    ].join('\n\n'),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#f3eff8;font-family:Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f3eff8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:560px;border:1px solid #ddd3eb;border-radius:14px">
<tr><td style="padding:26px 24px 6px;color:#4d287e;font-size:17px;font-weight:bold">Wisesama</td></tr>
<tr><td style="padding:12px 24px 6px"><h1 style="margin:0 0 16px;color:#21192b;font-size:26px;line-height:1.25;overflow-wrap:anywhere">${escapeHtml(title)}</h1>${paragraphHtml}${button}</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #ebe3f1;color:#5e5569;font-size:13px;line-height:1.5">${escapeHtml(footer)}${secondaryUrl && secondary ? `<br><a href="${secondaryUrl}" style="color:#4d287e">${escapeHtml(secondary.label)}</a>` : ''}</td></tr>
</table></td></tr></table></body></html>`,
  };
}

export function signInEmail(url: string) {
  return renderEmail({
    subject: 'Your Wisesama sign-in link',
    title: 'Continue to Wisesama',
    preheader: 'Your one-time link to sign in or finish creating your account.',
    paragraphs: [
      'You requested an email sign-in link for Wisesama.',
      'Open the link in the browser where you want to use Wisesama, then choose Continue. If you’re new, that step creates your account.',
    ],
    action: { label: 'Continue to Wisesama', href: url },
    footer:
      'This link works once and expires in 10 minutes. Keep it private. If you didn’t request it, you can ignore this email.',
  });
}

export function verificationEmail(url: string) {
  return renderEmail({
    subject: 'Verify your Wisesama email',
    title: 'Verify your email',
    preheader: 'Confirm this address to finish setting up your Wisesama account.',
    paragraphs: ['Confirm this address to finish setting up your Wisesama account.'],
    action: { label: 'Verify email', href: url },
    footer: 'This link expires in one hour. If you didn’t request it, you can ignore this email.',
  });
}

export function notificationTestEmail(appUrl: string) {
  return renderEmail({
    subject: 'Your Wisesama test alert',
    title: 'Your Wisesama test alert',
    preheader: 'This is the test you requested from Notification settings.',
    paragraphs: [
      'You requested this test from Notification settings.',
      'Wisesama can email you when a tracked dependency matches an advisory or when a finding changes.',
    ],
    action: { label: 'Open notification settings', href: `${appUrl}/app/settings/notifications` },
    footer: 'This test doesn’t report a finding in one of your projects.',
  });
}

export function dependencyAlertEmail(input: {
  project: string;
  dependency: string;
  version: string;
  severity: string;
  exploited: boolean;
  fixedVersion?: string | null;
  findingId: string;
  appUrl: string;
  changed: boolean;
}) {
  const title = input.changed ? 'A dependency finding changed' : 'A dependency needs review';
  const subject =
    `${input.project}: ${input.dependency} ${input.changed ? 'finding updated' : 'needs review'}`
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 250);
  return renderEmail({
    subject,
    title,
    preheader: `${input.dependency} ${input.version} in ${input.project} matches an advisory.`,
    paragraphs: [
      `${input.project} tracks ${input.dependency} ${input.version}, which matches a published advisory.`,
      `Severity: ${input.severity[0]?.toUpperCase() ?? ''}${input.severity.slice(1)}\nExploitation: ${input.exploited ? 'Reported by the advisory source' : 'Unconfirmed'}`,
      'This match is based on the dependency version you track. Exposure in your deployment is unverified.',
      input.fixedVersion
        ? `The advisory lists ${input.fixedVersion} as a fixed version. Check what’s deployed before choosing an update.`
        : 'Check what’s deployed and review the advisory for recommended steps.',
    ],
    action: {
      label: 'Review finding',
      href: `${input.appUrl}/app/findings/${encodeURIComponent(input.findingId)}`,
    },
    footer: 'You’re receiving this because you enabled email alerts for your Wisesama account.',
    secondary: { label: 'Manage email alerts', href: `${input.appUrl}/app/settings/notifications` },
  });
}

/** Deliveries store their final plain-text content so retries send the same message. */
export function renderStoredAlert(subject: string, body: string, appUrl: string) {
  const sections = body.split('\n\n');
  const title = sections.shift() || subject;
  const settingsUrl = `${appUrl}/app/settings/notifications`;
  const findingPrefix = `${appUrl}/app/findings/`;
  const actionIndex = sections.findIndex((section, index) => {
    const remaining = sections.length - index;
    if (remaining !== 2 && remaining !== 3) return false;
    const separator = section.indexOf(': ');
    if (separator < 0) return false;
    const label = section.slice(0, separator);
    const href = section.slice(separator + 2);
    return (
      (label === 'Review finding' &&
        href.startsWith(findingPrefix) &&
        /^[\w%-]+$/.test(href.slice(findingPrefix.length)) &&
        sections[index + 2] === `Manage email alerts: ${settingsUrl}`) ||
      (label === 'Open notification settings' && href === settingsUrl && remaining === 2)
    );
  });
  if (actionIndex < 0)
    return renderEmail({
      subject,
      title: subject,
      preheader: subject,
      paragraphs: [body],
      footer: 'Wisesama security alerts',
    }).html;
  const actionLine = sections[actionIndex]!;
  const separator = actionLine.indexOf(': ');
  return renderEmail({
    subject,
    title,
    preheader: sections[0] || title,
    paragraphs: sections.slice(0, actionIndex),
    action: { label: actionLine.slice(0, separator), href: actionLine.slice(separator + 2) },
    footer: sections[actionIndex + 1] || 'Wisesama security alerts',
    secondary: sections[actionIndex + 2]
      ? { label: 'Manage email alerts', href: settingsUrl }
      : undefined,
  }).html;
}
