import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import { isOneKeyHardwareError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import type {
  IPrivacyChainWalletType,
  IPrivacyEnableFailureReason,
  IPrivacyFirstSyncFailureReason,
  IPrivacySyncDurationBucket,
} from '@onekeyhq/shared/src/logger/scopes/wallet/scenes/privacyChain';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { isLocalWalletStorageUnsupportedError } from '../vaults/localWallet/storageSupport';
import {
  getLocalWalletSyncErrorKind,
  isLocalWalletRuntimeTimeoutError,
  isLocalWalletSlotsFullError,
} from '../vaults/localWallet/userFacingError';

const HARDWARE_USER_CANCEL_CODES = new Set<number | string | undefined>([
  HardwareErrorCode.ActionCancelled,
  HardwareErrorCode.PinCancelled,
  HardwareErrorCode.CallQueueActionCancelled,
]);

export function getPrivacyChainWalletType(
  accountId: string,
): IPrivacyChainWalletType {
  if (accountUtils.isHwAccount({ accountId })) return 'hw';
  if (accountUtils.isHdAccount({ accountId })) return 'hd';
  return 'other';
}

// By class and code only: a message may carry device or node detail.
export function getPrivacyEnableFailureReason<TError>(
  error: TError,
): IPrivacyEnableFailureReason {
  if (errorToastUtils.isUserCancelStyleError(error)) return 'user_cancelled';
  if (isOneKeyHardwareError(error)) {
    return HARDWARE_USER_CANCEL_CODES.has(error.code) ||
      HARDWARE_USER_CANCEL_CODES.has(error.payload?.code)
      ? 'user_cancelled'
      : 'device_error';
  }
  if (isLocalWalletSlotsFullError(error)) return 'limit_reached';
  if (isLocalWalletStorageUnsupportedError(error)) {
    return 'storage_unsupported';
  }
  if (getLocalWalletSyncErrorKind(error) === 'nodeUnreachable') {
    return 'node_unreachable';
  }
  return 'unknown';
}

export function getPrivacyFirstSyncFailureReason<TError>(
  error: TError,
): IPrivacyFirstSyncFailureReason {
  if (isLocalWalletRuntimeTimeoutError(error)) return 'timeout';
  switch (getLocalWalletSyncErrorKind(error)) {
    case undefined:
      return 'storage_unsupported';
    case 'runtimeUnavailable':
      return 'runtime_unavailable';
    case 'nodeUnreachable':
      return 'node_unreachable';
    default:
      return 'failed';
  }
}

const MINUTE_MS = 60_000;

export function getPrivacySyncDurationBucket(
  ms: number,
): IPrivacySyncDurationBucket {
  if (ms < 5 * MINUTE_MS) return 'under_5m';
  if (ms < 30 * MINUTE_MS) return '5m_30m';
  if (ms < 120 * MINUTE_MS) return '30m_2h';
  if (ms < 360 * MINUTE_MS) return '2h_6h';
  return 'over_6h';
}
