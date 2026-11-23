import { describe, expect, it } from 'vitest';
import {
  dependencyAlertEmail,
  notificationTestEmail,
  renderStoredAlert,
  verificationEmail,
} from '../workspace-email-template';

const origin = 'https://www.wisesama.com';

describe('workspace email templates', () => {
  it('provides the verification action in HTML and plain text', () => {
    const url = `${origin}/verify?token=example&next=account`;
    const email = verificationEmail(url);
    expect(email.html).toContain(
      'href="https://www.wisesama.com/verify?token=example&amp;next=account"',
    );
    expect(email.text).toContain(url);
    expect(verificationEmail('javascript:alert(1)').html).not.toContain('javascript:');
  });

  it('keeps the finding action and escapes project and dependency text', () => {
    const email = dependencyAlertEmail({
      project: '<img src=x>',
      dependency: 'example-package',
      version: '2.4.1',
      severity: 'high',
      exploited: false,
      fixedVersion: '2.4.2',
      findingId: 'finding-1',
      appUrl: origin,
      changed: false,
    });
    const html = renderStoredAlert(email.subject, email.text, origin);
    expect(html).toContain('href="https://www.wisesama.com/app/findings/finding-1"');
    expect(html).toContain('href="https://www.wisesama.com/app/settings/notifications"');
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
    expect(email.text).toContain('Exploitation: Unconfirmed');
  });

  it('retains the test action and treats unexpected stored links as text', () => {
    const test = notificationTestEmail(origin);
    expect(renderStoredAlert(test.subject, test.text, origin)).toContain(
      'href="https://www.wisesama.com/app/settings/notifications"',
    );
    const legacy = 'Old message\n\nReview finding: https://other.example/path\n\nFooter';
    expect(renderStoredAlert('Old subject', legacy, origin)).not.toContain(
      'href="https://other.example',
    );
  });
});
