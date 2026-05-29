/**
 * OpenAI OAuth flow for the ChatGPT subscription, following the same shape as
 * the open-source OpenAI Codex CLI. Constants verified against codex-rs/login.
 *
 * Notes:
 *   - Authorize uses the standard PKCE pattern plus three Codex-specific query
 *     parameters (id_token_add_organizations, codex_cli_simplified_flow,
 *     originator).
 *   - Initial code → token exchange uses application/x-www-form-urlencoded.
 *   - Token REFRESH uses application/json (this differs from the initial
 *     exchange — matches codex-rs/login/src/auth/manager.rs).
 *   - The access_token is short-lived; the id_token is a JWT carrying the
 *     user's email and chatgpt_account_id, which we extract for display only.
 */

import { generatePKCECodes, generateRandomString } from './_oauthBase';
import { testConnection, TestResult } from '../testConnection';
import { OpenAIProviderConfig } from '../../storage/aiConfig';
import { decodeJwtPayload } from '../../utils/jwt';

// ─── Constants (Codex CLI public client) ──────────────────────────────────

const ISSUER = 'https://auth.openai.com';
const AUTH_URL = `${ISSUER}/oauth/authorize`;
const TOKEN_URL = `${ISSUER}/oauth/token`;

/** Codex CLI's public OAuth client ID. Public on purpose — it's PKCE. */
export const OPENAI_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const OPENAI_CALLBACK_PORT = 1455;
export const OPENAI_CALLBACK_PATH = '/auth/callback';
export const OPENAI_REDIRECT_URI = `http://localhost:${OPENAI_CALLBACK_PORT}${OPENAI_CALLBACK_PATH}`;
const SCOPE =
  'openid profile email offline_access api.connectors.read api.connectors.invoke';
const ORIGINATOR = 'codex_cli_rs';

const STATE_KEY = 'openai';

// ─── ID-token claim extraction ────────────────────────────────────────────

interface OpenAIIdClaims {
  email?: string;
  'https://api.openai.com/auth'?: {
    chatgpt_account_id?: string;
    chatgpt_plan_type?: string;
    user_id?: string;
    organization_id?: string;
  };
  chatgpt_account_id?: string;
  chatgpt_plan_type?: string;
}

interface OpenAITokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  expires_in?: number;
}

function extractIdentity(idToken: string): {
  email: string;
  accountId: string;
  planType?: string;
} {
  const claims = decodeJwtPayload<OpenAIIdClaims>(idToken);
  const auth = claims['https://api.openai.com/auth'] || {};
  return {
    email: claims.email || 'unknown',
    accountId: auth.chatgpt_account_id || claims.chatgpt_account_id || '',
    planType: auth.chatgpt_plan_type || claims.chatgpt_plan_type || undefined,
  };
}

// ─── Authorize URL ────────────────────────────────────────────────────────

/**
 * Generates the authorize URL to open in a new tab. Saves the PKCE verifier
 * and state to sessionStorage so we can validate the redirect on the way back.
 */
export async function getOpenAIAuthUrl(): Promise<string> {
  const state = generateRandomString(32);
  const { codeVerifier, codeChallenge } = await generatePKCECodes();

  sessionStorage.setItem(`${STATE_KEY}_state`, state);
  sessionStorage.setItem(`${STATE_KEY}_verifier`, codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OPENAI_CLIENT_ID,
    redirect_uri: OPENAI_REDIRECT_URI,
    scope: SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    id_token_add_organizations: 'true',
    codex_cli_simplified_flow: 'true',
    state,
    originator: ORIGINATOR,
  });

  return `${AUTH_URL}?${params.toString()}`;
}

// ─── Token exchange (initial) ─────────────────────────────────────────────

export interface OpenAIConnectedTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number; // epoch ms
  email: string;
  accountId: string;
  planType?: string;
}

/**
 * Exchanges the authorisation code (extracted from the pasted redirect URL)
 * for an access token + refresh token + id token. Validates the state value
 * against the one stashed in sessionStorage at authorise time.
 */
export async function connectOpenAIWithCode(
  pastedText: string
): Promise<OpenAIConnectedTokens> {
  // Accept either a full redirect URL or a bare `code=...&state=...` fragment.
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

  // application/x-www-form-urlencoded for the initial exchange.
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: OPENAI_REDIRECT_URI,
    client_id: OPENAI_CLIENT_ID,
    code_verifier: verifier,
  });

  let resp: Response;
  try {
    resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
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

  const data = (await resp.json()) as OpenAITokenResponse;
  if (!data.access_token || !data.refresh_token || !data.id_token) {
    throw new Error('Token response missing required fields.');
  }

  // Clear single-use PKCE values on success.
  sessionStorage.removeItem(`${STATE_KEY}_state`);
  sessionStorage.removeItem(`${STATE_KEY}_verifier`);

  const { email, accountId, planType } = extractIdentity(data.id_token);
  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
    expiresAt,
    email,
    accountId,
    planType,
  };
}

// ─── Token refresh (uses JSON body, not URL-encoded) ──────────────────────

/**
 * Silently refresh an expiring access token. Important: OpenAI's refresh
 * endpoint expects a JSON body — different from the initial code exchange.
 */
export async function refreshOpenAITokens(refreshToken: string): Promise<OpenAIConnectedTokens> {
  let resp: Response;
  try {
    resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: OPENAI_CLIENT_ID,
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

  const data = (await resp.json()) as OpenAITokenResponse;
  if (!data.access_token || !data.id_token) {
    throw new Error('Refresh response missing required fields.');
  }

  const { email, accountId, planType } = extractIdentity(data.id_token);
  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;

  return {
    accessToken: data.access_token,
    // OpenAI may rotate the refresh token; fall back to the old one if absent.
    refreshToken: data.refresh_token || refreshToken,
    idToken: data.id_token,
    expiresAt,
    email,
    accountId,
    planType,
  };
}

/**
 * Convenience wrapper that refreshes only if the token is within ~60 seconds
 * of expiring. Returns the updated config (caller persists), or null if no
 * refresh was needed.
 */
export async function refreshOpenAITokensIfNeeded(
  config: OpenAIProviderConfig
): Promise<OpenAIProviderConfig | null> {
  if (!config.accessToken || !config.refreshToken || !config.expiresAt) {
    return null;
  }
  const isNearingExpiry = config.expiresAt - Date.now() < 60 * 1000;
  if (!isNearingExpiry) {
    return null;
  }

  const fresh = await refreshOpenAITokens(config.refreshToken);
  return {
    ...config,
    accessToken: fresh.accessToken,
    refreshToken: fresh.refreshToken,
    expiresAt: fresh.expiresAt,
    identity: fresh.email,
  };
}

// ─── Connection test ──────────────────────────────────────────────────────

/**
 * Round-trip ping against the configured model.
 */
export async function testOpenAIConnection(
  config: OpenAIProviderConfig
): Promise<TestResult> {
  return testConnection('openai', config);
}
