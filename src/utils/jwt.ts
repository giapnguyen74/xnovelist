/**
 * Minimal JWT payload decoder. We never verify signatures here — the token is
 * trusted because it came directly from the provider's authenticated token
 * endpoint over TLS. This is only used to extract identity claims (email,
 * chatgpt_account_id, plan type) for display purposes.
 */
export function decodeJwtPayload<T = unknown>(token: string): T {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Invalid JWT: expected three dot-separated segments.');
  }
  let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  // Re-pad the base64 string.
  while (payload.length % 4 !== 0) payload += '=';
  try {
    const json = decodeURIComponent(
      atob(payload)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as T;
  } catch (e) {
    throw new Error('Invalid JWT payload: ' + (e as Error).message);
  }
}
