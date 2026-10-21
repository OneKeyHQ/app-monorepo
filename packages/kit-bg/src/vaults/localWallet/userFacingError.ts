import { getPrivacyChainRuntimeFailure } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

import { localWalletText } from './messages';
import {
  isLocalWalletStorageUnsupportedError,
  readLocalWalletErrorCode,
} from './storageSupport';

import type { ILocalWalletSyncErrorKind } from './types';

export const LOCAL_WALLET_SYNC_TIMEOUT_MESSAGE =
  'privacy-chain: wallet-runtime sync timed out';

export const LOCAL_WALLET_CHAIN_TIP_TIMEOUT_MESSAGE =
  'privacy-chain: chain tip request timed out';

// The mobile bridge to the web-embed WebView gave up on a runtime call.
const WEBEMBED_CALL_TIMEOUT_MESSAGE = 'WebEmbed bridge call timeout';

function readErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return '';
  const { message } = error as { message?: unknown };
  return typeof message === 'string' ? message : '';
}

// A runtime call abandoned by a watchdog: the Worker is alive but stuck.
export function isLocalWalletRuntimeTimeoutError(error: unknown): boolean {
  const message = readErrorMessage(error);
  return (
    message.includes(LOCAL_WALLET_SYNC_TIMEOUT_MESSAGE) ||
    message.includes(WEBEMBED_CALL_TIMEOUT_MESSAGE)
  );
}

function isLocalWalletRuntimeUnavailableError(error: unknown): boolean {
  return (
    getPrivacyChainRuntimeFailure(error) !== undefined ||
    isLocalWalletRuntimeTimeoutError(error)
  );
}

// Copy for failures any privacy chain can hit; chain-specific codes are
// worded by the chain's own mapper before they get here.
function getLocalWalletUserMessage(error: unknown): string | undefined {
  if (isLocalWalletRuntimeUnavailableError(error)) {
    return ETranslationsMock.privacy_error_runtime_unavailable__msg;
  }
  switch (readLocalWalletErrorCode(error)) {
    case 'NETWORK_ERROR':
      return localWalletText(ETranslations.privacy_error_node_unreachable__msg);
    case 'NODE_NOT_CONFIGURED':
    case 'LIGHTWALLETD_NOT_CONFIGURED':
      return localWalletText(ETranslations.privacy_error_no_node__msg);
    case 'STORAGE_UNSUPPORTED':
      return localWalletText(ETranslations.privacy_error_webview_outdated__msg);
    case 'DATABASE_TOO_NEW':
      return localWalletText(ETranslations.database_read_error_update_app__msg);
    default:
      return undefined;
  }
}

/**
 * For a user-initiated action: the error must reach the user through the
 * standard auto-toast, worded for them when it is a known failure. Anything
 * else keeps its own message and an explicit autoToast choice.
 */
export function toLocalWalletUserFacingError(error: unknown): unknown {
  const message = getLocalWalletUserMessage(error);
  if (message) {
    return new OneKeyLocalError({ message, autoToast: true });
  }
  errorToastUtils.toastIfError(error);
  return error;
}

// Method decorator for user-initiated background methods.
export function toastLocalWalletError() {
  return (
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>,
  ) => {
    const originalMethod = descriptor.value;
    if (!originalMethod) return descriptor;
    descriptor.value = async function (this: unknown, ...args: unknown[]) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await originalMethod.apply(this, args);
      } catch (error) {
        throw toLocalWalletUserFacingError(error);
      }
    };
    return descriptor;
  };
}

// Undefined for a device that cannot store the database: that has its own
// flag and is never retried.
export function getLocalWalletSyncErrorKind(
  error: unknown,
): ILocalWalletSyncErrorKind | undefined {
  if (isLocalWalletStorageUnsupportedError(error)) {
    return undefined;
  }
  if (isLocalWalletRuntimeUnavailableError(error)) {
    return 'runtimeUnavailable';
  }
  if (
    readLocalWalletErrorCode(error) === 'NETWORK_ERROR' ||
    readErrorMessage(error).includes(LOCAL_WALLET_CHAIN_TIP_TIMEOUT_MESSAGE)
  ) {
    return 'nodeUnreachable';
  }
  return 'failed';
}
