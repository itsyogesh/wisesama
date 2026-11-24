/** Keep the bearer token in a fragment until a person confirms sign-in. */
export function emailLinkLanding(verificationUrl: string, applicationUrl: string) {
  const verification = new URL(verificationUrl);
  if (!verification.searchParams.get('token')) throw new Error('Invalid sign-in link.');
  const landing = new URL('/sign-in/verify', applicationUrl);
  landing.hash = verification.searchParams.toString();
  return landing.href;
}
