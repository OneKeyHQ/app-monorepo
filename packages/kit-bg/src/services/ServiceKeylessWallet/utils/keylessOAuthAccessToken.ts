import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IKeylessOAuthAccessTokenRefreshResult,
  ISupabaseJWTPayload,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { EKeylessOAuthAccessTokenRefreshStatus } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IKeylessRealmOperation,
  IKeylessRealmTokenDiagnosticContext,
} from '@onekeyhq/shared/src/logger/scopes/wallet/scenes/keyless';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import {
  isDefinitiveSupabaseRefreshTokenRejectionError as isDefinitiveSupabaseRefreshTokenRejectionErrorShared,
  isRetryableSupabaseAuthError,
} from '@onekeyhq/shared/src/utils/supabaseAuthErrorUtils';
import { getKeylessSupabaseClient } from '@onekeyhq/shared/src/utils/supabaseClientUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

const KEYLESS_TOKEN_VALID_BUFFER_MS = timerUtils.getTimeDurationMs({
  minute: 5,
});

export type IRealmAccessTokenExchangeTombstone = 'confirmed' | 'presumed';

const exchangedRealmAccessTokenCache = new cacheUtils.LRUCache<
  string,
  IRealmAccessTokenExchangeTombstone
>({
  max: 1000,
  ttl: timerUtils.getTimeDurationMs({ hour: 2 }),
  ttlAutopurge: true,
});

let keylessRealmDiagnosticSequence = 0;

async function getRealmAccessTokenTombstoneKey(token: string): Promise<string> {
  const tokenHash = await appCrypto.hash.sha256(
    bufferUtils.toBuffer(token, 'utf-8'),
  );
  return bufferUtils.bytesToHex(tokenHash);
}

export async function buildKeylessRealmTokenDiagnosticContext(params: {
  operation: IKeylessRealmOperation;
  token: string;
}): Promise<IKeylessRealmTokenDiagnosticContext> {
  const { operation, token } = params;
  keylessRealmDiagnosticSequence += 1;
  const flowId = `${Date.now().toString(36)}-${keylessRealmDiagnosticSequence.toString(36)}`;
  let tokenExpiresAt: number | undefined;
  let tokenIssuedAt: number | undefined;
  let tokenFingerprint = 'unavailable';

  try {
    const decodedToken = stringUtils.decodeJWT(token) as ISupabaseJWTPayload;
    tokenExpiresAt =
      typeof decodedToken?.exp === 'number' ? decodedToken.exp : undefined;
    tokenIssuedAt =
      typeof decodedToken?.iat === 'number' ? decodedToken.iat : undefined;
  } catch {
    // Diagnostic metadata is best-effort and must not affect authentication.
  }

  try {
    const tokenHash = await appCrypto.hash.sha256(
      bufferUtils.toBuffer(token, 'utf-8'),
    );
    tokenFingerprint = bufferUtils.bytesToHex(tokenHash).slice(0, 12);
  } catch {
    // Diagnostic metadata is best-effort and must not affect authentication.
  }

  return {
    flowId,
    operation,
    runtimeRole: platformEnv.runtimeRole,
    tokenExpiresAt,
    tokenFingerprint,
    tokenIssuedAt,
  };
}

export async function getRealmAccessTokenExchangeTombstone(
  token: string,
): Promise<IRealmAccessTokenExchangeTombstone | undefined> {
  return exchangedRealmAccessTokenCache.get(
    await getRealmAccessTokenTombstoneKey(token),
  );
}

export async function setRealmAccessTokenExchangeTombstone(
  token: string,
  tombstone: IRealmAccessTokenExchangeTombstone,
): Promise<void> {
  exchangedRealmAccessTokenCache.set(
    await getRealmAccessTokenTombstoneKey(token),
    tombstone,
  );
}

function isKeylessAccessTokenValid(token: string | null): token is string {
  if (!token) {
    return false;
  }
  try {
    const decodedToken = stringUtils.decodeJWT(token) as ISupabaseJWTPayload;
    if (!decodedToken?.exp || typeof decodedToken.exp !== 'number') {
      return false;
    }
    return Date.now() < decodedToken.exp * 1000 - KEYLESS_TOKEN_VALID_BUFFER_MS;
  } catch {
    return false;
  }
}

export function doKeylessOAuthTokensRepresentSameIdentity(params: {
  previousAccessToken: string;
  refreshedAccessToken: string;
}): boolean {
  const { previousAccessToken, refreshedAccessToken } = params;
  try {
    const previousPayload = stringUtils.decodeJWT(
      previousAccessToken,
    ) as ISupabaseJWTPayload;
    const refreshedPayload = stringUtils.decodeJWT(
      refreshedAccessToken,
    ) as ISupabaseJWTPayload;
    const previousSupabaseUserId = previousPayload?.sub || '';
    const refreshedSupabaseUserId = refreshedPayload?.sub || '';
    const previousSocialUserId = previousPayload?.user_metadata?.sub || '';
    const refreshedSocialUserId = refreshedPayload?.user_metadata?.sub || '';
    const previousIssuer = previousPayload?.user_metadata?.iss || '';
    const refreshedIssuer = refreshedPayload?.user_metadata?.iss || '';

    return (
      !!previousSupabaseUserId &&
      previousSupabaseUserId === refreshedSupabaseUserId &&
      !!previousSocialUserId &&
      previousSocialUserId === refreshedSocialUserId &&
      !!previousIssuer &&
      previousIssuer === refreshedIssuer
    );
  } catch {
    return false;
  }
}

export function isDefinitiveSupabaseRefreshTokenRejectionError(
  error: unknown,
): boolean {
  return isDefinitiveSupabaseRefreshTokenRejectionErrorShared(error);
}

export async function isDefinitiveGoTrueRefreshTokenRejection(
  response: Response,
): Promise<boolean> {
  let body:
    | { code?: unknown; error?: unknown; error_code?: unknown }
    | undefined;
  try {
    body = (await response.json()) as typeof body;
  } catch {
    return false;
  }
  return isDefinitiveSupabaseRefreshTokenRejectionError(body);
}

export async function getActiveKeylessOAuthAccessToken(params?: {
  throwOnSessionRefreshError?: boolean;
}): Promise<string | null> {
  const { client } = getKeylessSupabaseClient();
  const sessionResult = await client.auth.getSession();
  if (sessionResult.error) {
    if (
      params?.throwOnSessionRefreshError ||
      isRetryableSupabaseAuthError(sessionResult.error)
    ) {
      throw sessionResult.error;
    }
    return null;
  }
  const token = sessionResult.data.session?.access_token ?? null;
  if (isKeylessAccessTokenValid(token)) {
    return token;
  }
  if (!sessionResult.data.session) {
    return null;
  }
  // Supabase only auto-refreshes close to expiry. Keyless uses a wider
  // validity buffer, so refresh explicitly before treating the token as absent.
  const refreshResult = await client.auth.refreshSession();
  if (refreshResult.error) {
    if (
      params?.throwOnSessionRefreshError ||
      isRetryableSupabaseAuthError(refreshResult.error)
    ) {
      throw refreshResult.error;
    }
    return null;
  }
  const refreshedToken = refreshResult.data.session?.access_token ?? null;
  if (!isKeylessAccessTokenValid(refreshedToken)) {
    if (params?.throwOnSessionRefreshError) {
      throw new OneKeyLocalError(
        'OAuth session refresh returned an invalid access token.',
      );
    }
    return null;
  }
  return refreshedToken;
}

export async function refreshKeylessOAuthAccessTokenForRealmExchange(params: {
  operation: Extract<
    IKeylessRealmOperation,
    'createOrRestore' | 'resetOrVerifyPin'
  >;
  previousAccessToken: string;
  validateRefreshedAccessToken: (
    refreshedAccessToken: string,
  ) => Promise<boolean>;
  buildDiagnosticContext: (params: {
    operation: IKeylessRealmOperation;
    token: string;
  }) => Promise<IKeylessRealmTokenDiagnosticContext>;
  hasRealmAccessTokenExchangeTombstone: (token: string) => Promise<boolean>;
}): Promise<IKeylessOAuthAccessTokenRefreshResult> {
  const {
    operation,
    previousAccessToken,
    validateRefreshedAccessToken,
    buildDiagnosticContext,
    hasRealmAccessTokenExchangeTombstone,
  } = params;
  const diagnosticContext = await buildDiagnosticContext({
    operation,
    token: previousAccessToken,
  });
  defaultLogger.wallet.keyless.oauthAccessTokenRefreshStarted(
    diagnosticContext,
  );
  const { client } = getKeylessSupabaseClient();
  let refreshResult: Awaited<ReturnType<typeof client.auth.refreshSession>>;
  try {
    refreshResult = await client.auth.refreshSession();
  } catch (error) {
    const errorDetails = error as {
      code?: unknown;
      message?: unknown;
      status?: unknown;
    };
    const isDefinitive = isDefinitiveSupabaseRefreshTokenRejectionError(error);
    defaultLogger.wallet.keyless.oauthAccessTokenRefreshResult({
      ...diagnosticContext,
      errorCode:
        typeof errorDetails?.code === 'string' ? errorDetails.code : undefined,
      errorMessage:
        typeof errorDetails?.message === 'string'
          ? errorDetails.message.slice(0, 300)
          : undefined,
      errorStatus:
        typeof errorDetails?.status === 'number'
          ? errorDetails.status
          : undefined,
      status: isDefinitive
        ? 'definitiveRefreshTokenError'
        : 'ambiguousRefreshError',
    });
    return {
      status: isDefinitive
        ? EKeylessOAuthAccessTokenRefreshStatus.NeedOAuthReauth
        : EKeylessOAuthAccessTokenRefreshStatus.NeedRetryOrOAuthReauth,
    };
  }
  if (refreshResult.error) {
    const isDefinitive = isDefinitiveSupabaseRefreshTokenRejectionError(
      refreshResult.error,
    );
    defaultLogger.wallet.keyless.oauthAccessTokenRefreshResult({
      ...diagnosticContext,
      errorCode: refreshResult.error.code,
      errorMessage: refreshResult.error.message.slice(0, 300),
      errorStatus: refreshResult.error.status,
      status: isDefinitive
        ? 'definitiveRefreshTokenError'
        : 'ambiguousRefreshError',
    });
    return {
      status: isDefinitive
        ? EKeylessOAuthAccessTokenRefreshStatus.NeedOAuthReauth
        : EKeylessOAuthAccessTokenRefreshStatus.NeedRetryOrOAuthReauth,
    };
  }

  const refreshedAccessToken = refreshResult.data.session?.access_token ?? null;
  if (!isKeylessAccessTokenValid(refreshedAccessToken)) {
    defaultLogger.wallet.keyless.oauthAccessTokenRefreshResult({
      ...diagnosticContext,
      status: 'invalidToken',
    });
    return {
      status: EKeylessOAuthAccessTokenRefreshStatus.NeedRetryOrOAuthReauth,
    };
  }

  const refreshedDiagnosticContext = await buildDiagnosticContext({
    operation,
    token: refreshedAccessToken,
  });
  const tokenChanged = refreshedAccessToken !== previousAccessToken;
  if (
    !tokenChanged &&
    (await hasRealmAccessTokenExchangeTombstone(refreshedAccessToken))
  ) {
    defaultLogger.wallet.keyless.oauthAccessTokenRefreshResult({
      ...diagnosticContext,
      refreshedTokenExpiresAt: refreshedDiagnosticContext.tokenExpiresAt,
      refreshedTokenFingerprint: refreshedDiagnosticContext.tokenFingerprint,
      refreshedTokenIssuedAt: refreshedDiagnosticContext.tokenIssuedAt,
      status: 'unchangedToken',
      tokenChanged,
    });
    return {
      status: EKeylessOAuthAccessTokenRefreshStatus.NeedRetryOrOAuthReauth,
    };
  }

  let identityMatched = false;
  try {
    identityMatched = await validateRefreshedAccessToken(refreshedAccessToken);
  } catch (error) {
    const errorDetails = error as {
      code?: unknown;
      message?: unknown;
      status?: unknown;
    };
    defaultLogger.wallet.keyless.oauthAccessTokenRefreshResult({
      ...diagnosticContext,
      errorCode:
        typeof errorDetails?.code === 'string' ? errorDetails.code : undefined,
      errorMessage:
        typeof errorDetails?.message === 'string'
          ? errorDetails.message.slice(0, 300)
          : undefined,
      errorStatus:
        typeof errorDetails?.status === 'number'
          ? errorDetails.status
          : undefined,
      refreshedTokenExpiresAt: refreshedDiagnosticContext.tokenExpiresAt,
      refreshedTokenFingerprint: refreshedDiagnosticContext.tokenFingerprint,
      refreshedTokenIssuedAt: refreshedDiagnosticContext.tokenIssuedAt,
      status: 'thrownError',
      tokenChanged,
    });
    return {
      status: EKeylessOAuthAccessTokenRefreshStatus.NeedRetryOrOAuthReauth,
    };
  }

  defaultLogger.wallet.keyless.oauthAccessTokenRefreshResult({
    ...diagnosticContext,
    identityMatched,
    refreshedTokenExpiresAt: refreshedDiagnosticContext.tokenExpiresAt,
    refreshedTokenFingerprint: refreshedDiagnosticContext.tokenFingerprint,
    refreshedTokenIssuedAt: refreshedDiagnosticContext.tokenIssuedAt,
    status: identityMatched ? 'success' : 'identityMismatch',
    tokenChanged,
  });
  return identityMatched
    ? {
        status: EKeylessOAuthAccessTokenRefreshStatus.Ready,
        accessToken: refreshedAccessToken,
      }
    : {
        status: EKeylessOAuthAccessTokenRefreshStatus.NeedRetryOrOAuthReauth,
      };
}
