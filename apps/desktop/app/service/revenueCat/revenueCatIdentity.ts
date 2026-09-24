import { app, dialog, net } from 'electron';

import { buildServiceEndpoint } from '@onekeyhq/shared/src/config/appConfig';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import {
  SUPABASE_STORAGE_KEY_PREFIX,
  getKeylessSupabaseAuthSessionKey,
  getSupabaseAuthSessionKey,
} from '@onekeyhq/shared/src/storage/SupabaseStorage/consts';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';
import type { IRevenueCatAuthContext } from '@onekeyhq/shared/types/prime/revenueCat';

import { i18nText } from '../../i18n';
import { getSecureItem } from '../../libs/store';

export type IVerifiedRevenueCatIdentity = {
  userId: string;
  email: string;
  isPrime: boolean;
  assertCurrentSession: () => void;
};

export function revenueCatIdentityChangedError() {
  return new OneKeyLocalError(
    i18nText(ETranslations.prime_onekey_id_session_changed__msg),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateRevenueCatAuthContext(
  value: unknown,
): asserts value is IRevenueCatAuthContext {
  if (
    !isRecord(value) ||
    !Object.values(EPrimeAuthSessionSource).includes(
      value.sessionSource as EPrimeAuthSessionSource,
    ) ||
    (value.endpointEnv !== 'prod' && value.endpointEnv !== 'test') ||
    typeof value.instanceId !== 'string' ||
    !value.instanceId.trim() ||
    value.instanceId.length > 1024 ||
    /[\r\n]/.test(value.instanceId)
  ) {
    throw revenueCatIdentityChangedError();
  }
}

function readSessionToken(key: string): string {
  try {
    const raw = getSecureItem(key);
    const session: unknown = raw ? JSON.parse(raw) : undefined;
    if (
      isRecord(session) &&
      typeof session.access_token === 'string' &&
      session.access_token &&
      session.access_token.length <= 32_768 &&
      !/[\r\n]/.test(session.access_token)
    ) {
      return session.access_token;
    }
  } catch {
    // Never include session material or network request headers in errors.
  }
  throw revenueCatIdentityChangedError();
}

export async function verifyRevenueCatIdentity(
  context: IRevenueCatAuthContext,
): Promise<IVerifiedRevenueCatIdentity> {
  validateRevenueCatAuthContext(context);
  const sessionKey = `${SUPABASE_STORAGE_KEY_PREFIX}${
    context.sessionSource === EPrimeAuthSessionSource.KeylessOAuth
      ? getKeylessSupabaseAuthSessionKey()
      : getSupabaseAuthSessionKey()
  }`;
  const token = readSessionToken(sessionKey);
  const assertCurrentSession = () => {
    if (readSessionToken(sessionKey) !== token) {
      throw revenueCatIdentityChangedError();
    }
  };
  // The renderer selects a known realm, never a URL or authentication token.
  // Stored credentials are still untrusted until the server verifies them.
  const endpoint = buildServiceEndpoint({
    serviceName: EServiceEndpointEnum.Prime,
    env: context.endpointEnv,
  });
  const requestData = async (pathname: string) => {
    try {
      const response = await net.fetch(`${endpoint}${pathname}`, {
        method: 'GET',
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'X-Onekey-Request-Token': token,
          'X-Onekey-Instance-Id': context.instanceId,
          'X-Onekey-Request-Platform': 'desktop',
          'X-Onekey-Request-Version': app.getVersion(),
        },
      });
      const body: unknown = await response.json();
      if (
        !response.ok ||
        !isRecord(body) ||
        body.code !== 0 ||
        !isRecord(body.data)
      ) {
        throw revenueCatIdentityChangedError();
      }
      return body.data;
    } catch {
      throw revenueCatIdentityChangedError();
    }
  };
  const [profile, info] = await Promise.all([
    requestData('/prime/v1/account/profile'),
    requestData('/prime/v1/user/info'),
  ]);
  assertCurrentSession();
  const account = profile.onekeyAccount;
  if (
    !isRecord(account) ||
    account.status !== 'active' ||
    typeof account.onekeyUserId !== 'string' ||
    !account.onekeyUserId ||
    account.onekeyUserId.length > 1024 ||
    account.onekeyUserId !== info.userId ||
    typeof info.isPrime !== 'boolean'
  ) {
    throw revenueCatIdentityChangedError();
  }
  // A masked or renderer-supplied label cannot identify the recipient safely.
  const email = account.normalizedEmail || account.displayEmail;
  if (
    typeof email !== 'string' ||
    !email.includes('@') ||
    email.length > 320 ||
    /[*\p{Cc}\p{Cf}]/u.test(email)
  ) {
    throw revenueCatIdentityChangedError();
  }
  return {
    userId: account.onekeyUserId,
    email,
    isPrime: info.isPrime,
    assertCurrentSession,
  };
}

export async function confirmRevenueCatIdentity(
  identity: IVerifiedRevenueCatIdentity,
): Promise<boolean> {
  const window = globalThis.$desktopMainAppFunctions?.getSafelyMainWindow?.();
  if (!window || window.isDestroyed()) {
    throw revenueCatIdentityChangedError();
  }
  // Confirmation runs in Electron main: an XSS can replace a stored token,
  // but cannot silently approve the resulting server-verified recipient.
  const result = await dialog.showMessageBox(window, {
    type: 'question',
    title: 'OneKey Prime',
    message: i18nText(ETranslations.continue_with_current_onekey_id__title),
    detail: `${identity.email}\n\n${i18nText(ETranslations.prime_gift_account__desc)}`,
    buttons: [
      i18nText(ETranslations.global_cancel),
      i18nText(ETranslations.global_confirm),
    ],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return result.response === 1;
}
