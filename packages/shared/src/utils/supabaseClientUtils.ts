// https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth?queryGroups=auth-store&auth-store=async-storage
import { createClient } from '@supabase/supabase-js';

import {
  KEYLESS_SUPABASE_PROJECT_URL,
  KEYLESS_SUPABASE_PUBLIC_API_KEY,
  SUPABASE_PROJECT_URL,
  SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import platformEnv, { ERuntimeRole } from '@onekeyhq/shared/src/platformEnv';
import supabaseStorageInstance from '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance';
import {
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';

import type { SupabaseClient } from '@supabase/supabase-js';

// do not add this on web env
// import 'react-native-url-polyfill/auto'; // TODO move to shared polyfill

let client: SupabaseClient | undefined;
let keylessClient: SupabaseClient | undefined;
const storage = supabaseStorageInstance;

/**
 * Whether THIS JS runtime is allowed to perform Supabase refresh-token
 * rotations (the auth-js auto-refresh ticker and the initialize-time
 * `_recoverAndRefresh` refresh).
 *
 * Why UNATTENDED auto-refresh is a hard requirement (and, consequently, why
 * the persisted session is NOT passcode-encrypted — do not "fix" this):
 * The Supabase access token is a ~1h JWT. Without refresh, every OneKey ID
 * backend call starts failing with 90002/90003 after expiry, the
 * invalid-token cleanup logs the user out, and because the refresh token is
 * single-use rotating with a server-side validity window, a long-enough
 * refresh gap makes recovery impossible without a full re-OAuth. Refresh
 * runs in the bg runtime on timers/request paths where NO user is present
 * to type a passcode, so the refresh token must be readable without user
 * interaction. Passcode-encrypting it (like the pre-unification legacy
 * keyless blob, which was only decrypted at explicit PIN-verify moments)
 * is architecturally incompatible with this flow. At-rest protection is
 * instead provided by the storage layer: OS secure storage on native/prod
 * desktop, and a non-extractable IndexedDB device key on ext/web (see
 * SupabaseStorage/sealedValueCodec.ts). Note the pre-unification legacy
 * EMAIL session had exactly this treatment in production (v6.4.0:
 * autoRefreshToken + persistSession into the same storage, plaintext on the
 * ext/web fallback) — the sealed codec upgraded both sessions.
 *
 * Refresh-token rotation race rationale:
 * Production runs multiple isolated JS runtimes over ONE shared native
 * session store (supabaseStorageInstance). Every runtime used to construct
 * its Supabase client with `autoRefreshToken: true`, so two runtimes'
 * auto-refresh tickers could independently rotate the SAME refresh token.
 * GoTrue's reuse detection allows re-using a rotated refresh token only
 * within a short (~10s) window; a second refresh with the stale token after
 * that window revokes the whole token family, and auth-js then removes the
 * session from the shared store — a spurious full logout. Therefore exactly
 * one runtime per platform — the background runtime — owns token refresh.
 *
 * Platform matrix (see platformEnv.runtimeRole / computeRuntimeRole):
 * - ext service worker (MV3) / background html (MV2) -> Background -> true
 * - ext UI (popup / sidepanel / expanded tab / passkey) -> Main -> false
 * - ext offscreen -> Main -> false
 * - native bg Hermes runtime (__ONEKEY_RUNTIME_KIND__ === 'background')
 *   -> Background -> true
 * - native main (UI) Hermes runtime -> Main -> false
 * - native without a bg thread (dev single-runtime) -> Standalone -> true
 * - desktop / web (main == bg in one JS context) -> Standalone -> true
 * - webembed -> Main -> false
 *
 * `platformEnv.runtimeRole` is computed at platformEnv module load from
 * build-time flags plus the `__ONEKEY_RUNTIME_KIND__` global, which the
 * native entrypoints (apps/mobile/index.ts, apps/mobile/background.ts) set
 * before any import runs — so it is reliable at client-construction time in
 * every context and no explicit init parameter is needed.
 *
 * IMPORTANT (verified against @supabase/auth-js@2.86.2):
 * `autoRefreshToken: false` only disables the 30s refresh ticker and the
 * initialize-time `_recoverAndRefresh()` network refresh. It does NOT
 * disable the on-demand refresh inside `getSession()` (`__loadSession()`
 * calls `_callRefreshToken()` for an expired session regardless of the
 * flag). UI runtimes must therefore route steady-state token READS through
 * the bg bridge (`backgroundApiProxy.simpleDb.prime.getSupabaseAuthToken`
 * etc.) instead of calling `client.auth.getSession()` on a possibly-expired
 * session.
 *
 * Known residual (not fixable without patching supabase-js): the
 * SupabaseClient constructor subscribes `onAuthStateChange` internally
 * (`_listenForAuthEvents`), and every subscription asynchronously runs
 * `_emitInitialSession()` -> `__loadSession()`, which refreshes an
 * already-expired stored session once at client construction even with
 * `autoRefreshToken: false`. This only fires when the stored session is
 * expired at construction (cold start after a long sleep), where bg and UI
 * refresh within seconds of each other — inside GoTrue's ~10s refresh-token
 * reuse grace window — unlike the >10s ticker drift this flag eliminates.
 */
export function isSupabaseTokenRefreshRuntime(): boolean {
  return platformEnv.runtimeRole !== ERuntimeRole.Main;
}

export function getSupabaseClient() {
  if (!client) {
    client = createClient(
      SUPABASE_PROJECT_URL ?? '',
      SUPABASE_PUBLIC_API_KEY ?? '',
      {
        auth: {
          storage,
          storageKey: getSupabaseAuthSessionKey(),
          // Only the bg/standalone runtime refreshes tokens; see
          // isSupabaseTokenRefreshRuntime for the rotation-race rationale.
          autoRefreshToken: isSupabaseTokenRefreshRuntime(),
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce', // Use PKCE flow for better security - tokens are never exposed in URL
        },
      },
    );
  }
  return { client, storage };
}

export function getKeylessSupabaseClient() {
  if (!keylessClient) {
    keylessClient = createClient(
      KEYLESS_SUPABASE_PROJECT_URL ?? '',
      KEYLESS_SUPABASE_PUBLIC_API_KEY ?? '',
      {
        auth: {
          storage,
          storageKey: getKeylessSupabaseAuthSessionKey(),
          // Only the bg/standalone runtime refreshes tokens; see
          // isSupabaseTokenRefreshRuntime for the rotation-race rationale.
          autoRefreshToken: isSupabaseTokenRefreshRuntime(),
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      },
    );
  }
  return { client: keylessClient, storage };
}

/**
 * Create a temporary Supabase client that does not persist sessions automatically.
 * This is useful for OAuth flows where you want to get session data without
 * automatically writing it to storage.
 *
 * @returns A Supabase client configured with persistSession: false
 */
export function createTemporarySupabaseClient() {
  return createClient(
    KEYLESS_SUPABASE_PROJECT_URL ?? '',
    KEYLESS_SUPABASE_PUBLIC_API_KEY ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false, // Don't persist session automatically
        detectSessionInUrl: false,
        flowType: 'pkce', // Use PKCE flow for better security - tokens are never exposed in URL
      },
    },
  );
}
