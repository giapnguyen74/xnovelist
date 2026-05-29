/**
 * Anthropic Claude OAuth flow against the Claude Pro / Max subscription,
 * following the same pattern as the open-source Claude Code CLI. Constants
 * verified against Claude Code's published reference.
 *
 * Differences from OpenAI's flow that matter:
 *   - Authorize URL is on claude.ai, NOT api.anthropic.com.
 *   - The authorize URL takes a `code=true` flag for the simplified
 *     copy-paste flow (analogous to Codex's codex_cli_simplified_flow).
 *   - Scope contains colons that MUST stay unencoded (e.g. `user:profile`,
 *     not `user%3Aprofile`). URLSearchParams would percent-encode them, so we
 *     hand-roll the scope param.
 *   - Token endpoint uses JSON body for BOTH the initial exchange and the
 *     refresh (OpenAI uses form-encoded for the initial).
 *   - No id_token / JWT — identity comes from `data.account.email_address`
 *     in the JSON response.
 *   - Redirect URI is on port 54545 (not 1455) and path /callback (not
 *     /auth/callback). Must match what Anthropic has registered for the
 *     Claude Code client.
 */

import { generatePKCECodes, generateRandomString } from './_oauthBase';
import { testConnection, TestResult } from '../testConnection';
import { AnthropicProviderConfig } from '../../storage/aiConfig';

// ─── Constants (Claude Code public client) ────────────────────────────────

const AUTH_URL = 'https://claude.ai/oauth/authorize';
const TOKEN_URL = 'https://api.anthropic.com/v1/oauth/token';

/** Claude Code's public OAuth client ID. Public on purpose — it's PKCE. */
export const ANTHROPIC_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
export const ANTHROPIC_CALLBACK_PORT = 54545;
export const ANTHROPIC_CALLBACK_PATH = '/callback';
export const ANTHROPIC_REDIRECT_URI = `http://localhost:${ANTHROPIC_CALLBACK_PORT}${ANTHROPIC_CALLBACK_PATH}`;
const SCOPE = 'org:create_api_key user:profile user:inference';

const STATE_KEY = 'anthropic';

// ─── Response shape ────────────────────────────────────────────────────────

interface AnthropicTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  account?: {
    email_address?: string;
    uuid?: string;
  };
}

// ─── Authorize URL ────────────────────────────────────────────────────────

/**
 * Generates the authorize URL to open in a new tab. Saves the PKCE verifier
 * and state to sessionStorage for the redirect round-trip.
 *
 * Note the custom scope encoding: Anthropic's OAuth server requires the
 * scope values to keep their colons unencoded. URLSearchParams would emit
 * `user%3Aprofile`, which the server rejects. We hand-roll that one param.
 */
export async function getAnthropicAuthUrl(): Promise<string> {
  const state = generateRandomString(32);
  const { codeVerifier, codeChallenge } = await generatePKCECodes();

  sessionStorage.setItem(`${STATE_KEY}_state`, state);
  sessionStorage.setItem(`${STATE_KEY}_verifier`, codeVerifier);

  const standardParams = new URLSearchParams({
    code: 'true',                       // simplified copy-paste flow flag
    client_id: ANTHROPIC_CLIENT_ID,
    response_type: 'code',
    redirect_uri: ANTHROPIC_REDIRECT_URI,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  // Encode scope per segment, then restore the colons that the server expects
  // to see raw. Spaces between scopes become '+' (the OAuth spec equivalent).
  const scopeEncoded = SCOPE.split(' ')
    .map((s) => encodeURIComponent(s).replace(/%3A/gi, ':'))
    .join('+');

  return `${AUTH_URL}?${standardParams.toString()}&scope=${scopeEncoded}`;
}

// ─── Token exchange (initial) ─────────────────────────────────────────────

export interface AnthropicConnectedTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  email: string;
  accountUuid: string;
}

/**
 * Exchanges the authorisation code (extracted from the pasted redirect URL)
 * for access + refresh tokens. Validates state. Note: JSON body, not
 * form-encoded — Anthropic's token endpoint differs from OpenAI's initial
 * exchange here.
 */
export async function connectAnthropicWithCode(
  pastedText: string
): Promise<AnthropicConnectedTokens> {
  let searchParams: URLSearchParams;
  try {
    if (pastedText.includes('?')) {
      searchParams = new URL(pastedText.trim()).searchParams;
    } else {
      searchParams = new URLSearchParams(pastedText.trim());
    }
  } catch {
    throw new Error('Could not read the pasted text. Paste the full redirect URL.');
  }

  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');
  if (!code) throw new Error('No authorisation code found in the pasted text.');

  const expectedState = sessionStorage.getItem(`${STATE_KEY}_state`);
  const verifier = sessionStorage.getItem(`${STATE_KEY}_verifier`);
  if (!expectedState || !verifier) {
    throw new Error('No active sign-in session. Click "Sign in" again to restart.');
  }
  if (returnedState !== expectedState) {
    throw new Error('Security check failed: state mismatch. Restart the sign-in.');
  }

  let resp: Response;
  try {
    resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        grant_type: 'authorization_code',
        client_id: ANTHROPIC_CLIENT_ID,
        redirect_uri: ANTHROPIC_REDIRECT_URI,
        code_verifier: verifier,
        state: expectedState,
      }),
    });
  } catch (err) {
    throw new Error(
      `Network error during token exchange: ${(err as Error).message || String(err)}`
    );
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Token exchange failed (${resp.status}): ${text || resp.statusText}`);
  }

  const data = (await resp.json()) as AnthropicTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    throw new Error('Token response missing required fields.');
  }

  sessionStorage.removeItem(`${STATE_KEY}_state`);
  sessionStorage.removeItem(`${STATE_KEY}_verifier`);

  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    email: data.account?.email_address || 'unknown',
    accountUuid: data.account?.uuid || '',
  };
}

// ─── Token refresh ────────────────────────────────────────────────────────

/**
 * Silently refresh an expiring access token. Anthropic uses JSON body for
 * both exchange and refresh.
 */
export async function refreshAnthropicTokens(
  refreshToken: string
): Promise<AnthropicConnectedTokens> {
  let resp: Response;
  try {
    resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: ANTHROPIC_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
  } catch (err) {
    throw new Error(
      `Network error during token refresh: ${(err as Error).message || String(err)}`
    );
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Token refresh failed (${resp.status}): ${text || resp.statusText}`);
  }

  const data = (await resp.json()) as AnthropicTokenResponse;
  if (!data.access_token) {
    throw new Error('Refresh response missing required fields.');
  }

  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;

  return {
    accessToken: data.access_token,
    // Anthropic may rotate refresh tokens; fall back to the old one if absent.
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
    email: data.account?.email_address || 'unknown',
    accountUuid: data.account?.uuid || '',
  };
}

/**
 * Convenience wrapper that refreshes only if the token is within ~60 seconds
 * of expiring. Returns the updated config, or null if no refresh was needed.
 */
export async function refreshAnthropicTokensIfNeeded(
  config: AnthropicProviderConfig
): Promise<AnthropicProviderConfig | null> {
  if (!config.accessToken || !config.refreshToken || !config.expiresAt) {
    return null;
  }
  const isNearingExpiry = config.expiresAt - Date.now() < 60 * 1000;
  if (!isNearingExpiry) {
    return null;
  }

  const fresh = await refreshAnthropicTokens(config.refreshToken);
  return {
    ...config,
    accessToken: fresh.accessToken,
    refreshToken: fresh.refreshToken,
    expiresAt: fresh.expiresAt,
    identity: fresh.email,
  };
}

// ─── Connection test ──────────────────────────────────────────────────────

export async function testAnthropicConnection(
  config: AnthropicProviderConfig
): Promise<TestResult> {
  return testConnection('anthropic', config);
}
