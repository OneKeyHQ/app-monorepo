import { Dialog } from '@onekeyhq/components';
import { OAUTH_CALLBACK_DESKTOP_CHANNEL } from '@onekeyhq/shared/src/consts/oauthConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { createTemporarySupabaseClient } from './supabase/getSupabaseClient';

import type {
  IHandleOAuthSessionPersistenceParams,
  IOAuthPopupResult,
} from './openOAuthPopupWeb';

// Google OAuth Client ID for Desktop App
// TODO: Move this to environment variables or config
// This should be a "Desktop App" type OAuth Client from Google Cloud Console
// IMPORTANT: Desktop Application should NOT have a client_secret for security reasons
// If your Desktop App client has a client_secret, consider deleting it in Google Cloud Console
const GOOGLE_DESKTOP_CLIENT_ID =
  process.env.GOOGLE_DESKTOP_CLIENT_ID ||
  // TODO: Replace with actual Desktop App OAuth Client ID
  '244450898872-ncfr4k5vkk85ptkldbct2i9bpa0pideu.apps.googleusercontent.com';

/**
 * Default OAuth scopes for Google sign-in
 */
const DEFAULT_GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * OAuth helper for Desktop (Electron) platform using localhost HTTP server
 * with Google Authorization Code + PKCE + Supabase signInWithIdToken
 *
 * This method bypasses Supabase redirect URL restrictions by directly
 * interacting with Google OAuth and using signInWithIdToken.
 *
 * How it works:
 * 1. Starts a local HTTP server on a random port (127.0.0.1)
 * 2. Generates PKCE code verifier and challenge
 * 3. Builds Google OAuth URL with response_type=code (Desktop App requires code flow)
 * 4. Opens Google OAuth in system browser
 * 5. Google redirects to localhost:PORT/callback?code=xxx
 * 6. Local server extracts authorization code and sends to renderer process
 * 7. Renderer exchanges authorization code for id_token using PKCE
 * 8. Uses Supabase signInWithIdToken to exchange id_token for session
 *
 * Google Cloud Console Configuration:
 * - Create OAuth 2.0 Client ID, type: Desktop App
 * - Add Authorized redirect URIs: http://localhost and http://127.0.0.1
 *   (Google allows any port for Desktop App type when using localhost/127.0.0.1)
 *
 * Supabase Configuration:
 * - No redirect URL configuration needed
 * - Ensure Google Provider is enabled
 *
 * @param options - Configuration options
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session
 * @returns Promise with success status and session tokens
 */
export async function openOAuthPopupDesktopLocalhost(options: {
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession: boolean;
}): Promise<IOAuthPopupResult> {
  const { handleSessionPersistence, persistSession } = options;

  if (!GOOGLE_DESKTOP_CLIENT_ID) {
    throw new OneKeyLocalError(
      'Google Desktop OAuth Client ID is not configured',
    );
  }

  // Check if desktopApiProxy is available
  if (!platformEnv.isDesktop || !globalThis.desktopApiProxy?.oauthLocalServer) {
    throw new OneKeyLocalError(
      'Desktop OAuth Local Server API is not available',
    );
  }

  // Generate nonce for security (same as Extension)
  const rawNonce = crypto.randomUUID();
  const encoder = new TextEncoder();
  const nonceData = encoder.encode(rawNonce);
  const hashBuffer = await crypto.subtle.digest('SHA-256', nonceData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedNonce = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Generate PKCE code verifier and challenge for Desktop App OAuth flow
  // Desktop Application type requires PKCE for security (no client_secret)
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
  const codeVerifierData = encoder.encode(codeVerifier);
  const codeVerifierHash = await crypto.subtle.digest(
    'SHA-256',
    codeVerifierData,
  );
  const codeVerifierHashArray = Array.from(new Uint8Array(codeVerifierHash));
  // Base64 URL-safe encoding for PKCE challenge
  // Use btoa in browser/Electron renderer, or Buffer in Node.js
  const base64String =
    typeof btoa !== 'undefined'
      ? btoa(String.fromCharCode(...codeVerifierHashArray))
      : Buffer.from(codeVerifierHashArray).toString('base64');
  const codeChallenge = base64String
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        // 1. Start local OAuth server (random port)
        const result =
          await globalThis.desktopApiProxy.oauthLocalServer.startServer();
        const { port } = result;
        const redirectUri = `http://127.0.0.1:${port}/callback`;

        // 2. Build Google OAuth URL with authorization code flow
        // Desktop Application type doesn't support response_type=id_token directly
        // Must use response_type=code, then exchange code for id_token
        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_DESKTOP_CLIENT_ID);
        authUrl.searchParams.set('response_type', 'code'); // Use code flow for Desktop App
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', DEFAULT_GOOGLE_SCOPES.join(' '));
        authUrl.searchParams.set('nonce', hashedNonce); // Hashed nonce for Google
        authUrl.searchParams.set('code_challenge', codeChallenge); // PKCE challenge
        authUrl.searchParams.set('code_challenge_method', 'S256'); // PKCE method
        authUrl.searchParams.set('access_type', 'offline'); // Request refresh token
        authUrl.searchParams.set('prompt', 'select_account');

        // 3. Listen for callback with authorization code
        const handleCallback = async (
          _event: Electron.IpcRendererEvent,
          data: { code: string; idToken?: string },
        ) => {
          // Remove listener using desktopApi (for IPC events)
          if (globalThis.desktopApi) {
            globalThis.desktopApi.removeIpcEventListener(
              OAUTH_CALLBACK_DESKTOP_CHANNEL,
              handleCallback,
            );
          }

          let idToken = data.idToken;

          // If we received a code instead of id_token, exchange it for id_token
          if (!idToken && data.code) {
            try {
              // Exchange authorization code for id_token using PKCE
              // Desktop Application type MUST use PKCE and MUST NOT include client_secret
              // This is the secure way for public clients (desktop/mobile apps)
              const tokenParams = new URLSearchParams({
                client_id: GOOGLE_DESKTOP_CLIENT_ID,
                code: data.code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                code_verifier: codeVerifier, // PKCE verifier (required, replaces client_secret)
              });

              // DO NOT include client_secret - Desktop Apps are public clients
              // If Google requires client_secret, the Desktop App client may be incorrectly configured

              // Debug: Log the token request details (without sensitive data)
              console.log('[OAuth] Token exchange request:', {
                clientId: GOOGLE_DESKTOP_CLIENT_ID,
                redirectUri,
                grantType: 'authorization_code',
                hasCodeVerifier: !!codeVerifier,
                codeLength: data.code.length,
              });

              const tokenResponse = await fetch(
                'https://oauth2.googleapis.com/token',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                  body: tokenParams,
                },
              );

              if (!tokenResponse.ok) {
                const errorData = await tokenResponse.json();
                console.error('[OAuth] Token exchange error:', errorData);

                // If error is "client_secret is missing", this is a known Google issue
                // Desktop Application type should NOT require client_secret with PKCE
                // Possible solutions:
                // 1. Verify redirectUri matches exactly in Google Cloud Console
                // 2. Check if Desktop App client has any special configuration
                // 3. Try recreating the Desktop App client in Google Cloud Console
                const errorMessage =
                  `Token exchange failed: ${JSON.stringify(errorData)}. ` +
                  `Client ID: ${GOOGLE_DESKTOP_CLIENT_ID}, Redirect URI: ${redirectUri}. ` +
                  `If you see "client_secret is missing", this is a known Google OAuth issue. ` +
                  `Please verify: 1) OAuth client type is "Desktop App", 2) Redirect URI matches exactly in Google Cloud Console.`;
                throw new OneKeyLocalError(errorMessage);
              }

              const tokenData = (await tokenResponse.json()) as {
                id_token?: string;
                access_token?: string;
                error?: string;
              };

              if (!tokenData.id_token) {
                throw new OneKeyLocalError('No id_token in token response');
              }

              idToken = tokenData.id_token;
            } catch (error) {
              reject(
                new OneKeyLocalError(
                  error instanceof Error
                    ? error.message
                    : 'Failed to exchange authorization code',
                ),
              );
              return;
            }
          }

          if (!idToken) {
            resolve({ success: false, session: undefined });
            return;
          }

          try {
            // 4. Exchange id_token for Supabase session
            const tempClient = createTemporarySupabaseClient();
            const { data: authData, error } =
              await tempClient.auth.signInWithIdToken({
                provider: 'google',
                token: idToken,
                nonce: rawNonce, // Pass raw nonce (not hashed) to Supabase
              });

            if (error || !authData.session) {
              resolve({ success: false, session: undefined });
              return;
            }

            const { access_token: accessToken, refresh_token: refreshToken } =
              authData.session;

            // 5. Handle session persistence
            await handleSessionPersistence({
              accessToken,
              refreshToken,
              persistSession,
            });

            resolve({
              success: true,
              session: { accessToken, refreshToken },
            });
          } catch (error) {
            reject(
              new OneKeyLocalError(
                error instanceof Error ? error.message : 'OAuth failed',
              ),
            );
          }
        };

        // Add listener using desktopApi (for IPC events)
        if (globalThis.desktopApi) {
          globalThis.desktopApi.addIpcEventListener(
            OAUTH_CALLBACK_DESKTOP_CHANNEL,
            handleCallback,
          );
        }

        Dialog.debugMessage({
          title: 'OAuth',
          debugMessage: authUrl.href,
        });

        // 6. Open Google OAuth in system browser
        await globalThis.desktopApiProxy.oauthLocalServer.openBrowser(
          authUrl.href,
        );

        // 7. Timeout after 5 minutes
        setTimeout(() => {
          if (globalThis.desktopApi) {
            globalThis.desktopApi.removeIpcEventListener(
              OAUTH_CALLBACK_DESKTOP_CHANNEL,
              handleCallback,
            );
          }
          void globalThis.desktopApiProxy.oauthLocalServer.stopServer();
          reject(new OneKeyLocalError('OAuth sign-in timed out'));
        }, 5 * 60 * 1000);
      } catch (error) {
        reject(
          new OneKeyLocalError(
            error instanceof Error ? error.message : 'OAuth setup failed',
          ),
        );
      }
    })();
  });
}
