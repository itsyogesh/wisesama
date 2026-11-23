/** Bearer links and query values must never become routine HTTP log fields. */
export function requestLogUrl(url: string) {
  return url
    .replace(/\?.*$/, '')
    .replace(/(\/organization-invitations\/)[^/]+/g, '$1[redacted]')
    .replace(/(\/subscriptions\/one-click\/)[^/]+/g, '$1[redacted]');
}
