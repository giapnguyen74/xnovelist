/**
 * Shared OAuth helpers for the browser-side PKCE flow used by both the
 * OpenAI (Codex) and Anthropic (Claude Code) providers.
 *
 * The PKCE shape matches the reference implementations exactly:
 *   - 96 random bytes → base64url encoding → 128-character `code_verifier`
 *   - SHA-256(verifier) → base64url encoding → 43-character `code_challenge`
 *
 * Both lengths sit at PKCE's maxima (RFC 7636 §4.1 allows 43–128 chars for
 * the verifier). Using base64url instead of hex gives 6 bits of entropy per
 * character versus 4 — and, more importantly, mirrors what the providers'
 * authentication servers expect after observing the reference CLIs.
 */

export interface PKCECodes {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Base64url-encode a byte buffer (RFC 7636 §3 / RFC 4648 §5).
 *   - replace `+` with `-`
 *   - replace `/` with `_`
 *   - strip trailing `=` padding
 */
function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generates a paired (codeVerifier, codeChallenge) PKCE bundle. The 96-byte
 * length is chosen so the base64url-encoded verifier lands at exactly 128
 * characters — the maximum the spec allows and the value the reference
 * implementations use.
 */
export async function generatePKCECodes(): Promise<PKCECodes> {
  const verifierBytes = new Uint8Array(96);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(verifierBytes);
  } else {
    // Fallback for non-browser environments (tests, SSR pre-render). Not
    // cryptographically strong, but never reached in the real flow.
    for (let i = 0; i < verifierBytes.length; i++) {
      verifierBytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const codeVerifier = base64url(verifierBytes);

  const encoder = new TextEncoder();
  const digest = await window.crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
  const codeChallenge = base64url(new Uint8Array(digest));

  return { codeVerifier, codeChallenge };
}

/**
 * Generates a random hex string of exactly `length` characters. Used for the
 * OAuth `state` parameter (CSRF guard) — has no PKCE length constraint, but
 * we want a stable predictable length per call. 32 chars = 128 bits of
 * randomness, which is plenty for state.
 */
export function generateRandomString(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2));
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, length);
}
