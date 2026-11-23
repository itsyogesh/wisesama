import { describe, expect, it } from 'vitest';
import { requestLogUrl } from '../request-log';

describe('HTTP request log URL redaction', () => {
  it('removes all query values, including bearer invitation links', () => {
    expect(requestLogUrl('/invite?token=private-bearer&email=private@example.invalid')).toBe(
      '/invite',
    );
    expect(requestLogUrl('/api/v1/intel/workspace?organizationId=private-id')).toBe(
      '/api/v1/intel/workspace',
    );
  });

  it('masks public preview and acceptance path tokens', () => {
    expect(requestLogUrl('/api/v1/intel/organization-invitations/private-bearer')).toBe(
      '/api/v1/intel/organization-invitations/[redacted]',
    );
    expect(
      requestLogUrl(
        '/api/v1/intel/organization-invitations/private-bearer/accept?token=second-bearer',
      ),
    ).toBe('/api/v1/intel/organization-invitations/[redacted]/accept');
  });

  it('masks one-click unsubscribe path capabilities', () => {
    expect(requestLogUrl('/api/v1/intel/subscriptions/one-click/dummy-capability')).toBe(
      '/api/v1/intel/subscriptions/one-click/[redacted]',
    );
  });

  it('preserves safe route paths without query values', () => {
    expect(requestLogUrl('/api/v1/intel/organizations/org-1/members/member-1')).toBe(
      '/api/v1/intel/organizations/org-1/members/member-1',
    );
  });
});
