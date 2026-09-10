import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import type { IThirdPartyHardwareSearchTarget } from '@onekeyhq/shared/types/device';

import {
  THIRD_PARTY_HW_INTERACTION_ENDED_CODE,
  THIRD_PARTY_HW_INTERACTION_NOT_FOUND_CODE,
} from '../errors/errors/thirdPartyHardwareErrors';

import type { IHardwareErrorRecoveryHint } from '../errors/types/errorTypes';

export enum EThirdPartyHardwareRetryAction {
  retrySelectedSearchTarget = 'retrySelectedSearchTarget',
  restartDeviceSearch = 'restartDeviceSearch',
  doNotRetry = 'doNotRetry',
}

const RESCAN_DEVICE_ERROR_CODES = new Set<number>([
  ThirdPartyHwErrorCode.DeviceNotFound,
  ThirdPartyHwErrorCode.DeviceDisconnected,
  ThirdPartyHwErrorCode.DeviceMismatch,
  THIRD_PARTY_HW_INTERACTION_NOT_FOUND_CODE,
  THIRD_PARTY_HW_INTERACTION_ENDED_CODE,
  ThirdPartyHwErrorCode.TransportError,
  ThirdPartyHwErrorCode.BridgeNotFound,
  ThirdPartyHwErrorCode.TransportNotAvailable,
  ThirdPartyHwErrorCode.BlePairingTimeout,
  ThirdPartyHwErrorCode.ThpPairingFailed,
  ThirdPartyHwErrorCode.BleBondInvalid,
  ThirdPartyHwErrorCode.ThpPairingRequired,
  ThirdPartyHwErrorCode.BleConnectFailed,
]);

function getSearchTargetReusePolicy(
  searchTarget: IThirdPartyHardwareSearchTarget | undefined,
): IThirdPartyHardwareSearchTarget['searchTargetReusePolicy'] | undefined {
  if (!searchTarget) return undefined;
  // Missing metadata means an older SDK produced the target. Rediscovery is
  // the only safe cross-version default because the handle may be scoped to a
  // connector snapshot even when the post-connect device id is persistent.
  return searchTarget.searchTargetReusePolicy ?? 'rediscover';
}

/**
 * Chooses whether an onboarding retry may reuse its selected search target.
 * Device-action failures keep the current search target, while failures that
 * invalidate transport ownership return to discovery. The selected transport
 * remains owned by the connection page and is not changed by this decision.
 */
export function getThirdPartyHardwareRetryAction(params: {
  errorCode: number | undefined;
  recovery: IHardwareErrorRecoveryHint | undefined;
  searchTarget: IThirdPartyHardwareSearchTarget | undefined;
}): EThirdPartyHardwareRetryAction {
  const { errorCode, recovery, searchTarget } = params;
  const targetReusePolicy = getSearchTargetReusePolicy(searchTarget);

  if (recovery) {
    if (recovery.scope === 'not-recoverable') {
      return EThirdPartyHardwareRetryAction.doNotRetry;
    }
    if (recovery.scope === 'search-target' || recovery.scope === 'transport') {
      return EThirdPartyHardwareRetryAction.restartDeviceSearch;
    }
    if (
      recovery.scope === 'interaction' &&
      targetReusePolicy !== 'reconnectable'
    ) {
      return EThirdPartyHardwareRetryAction.restartDeviceSearch;
    }
    if (recovery.scope === 'operation' && targetReusePolicy === 'rediscover') {
      return EThirdPartyHardwareRetryAction.restartDeviceSearch;
    }
    if (recovery.scope !== 'unknown') {
      return EThirdPartyHardwareRetryAction.retrySelectedSearchTarget;
    }
  }

  // Compatibility fallback for SDK responses that predate recovery metadata.
  if (
    (errorCode !== undefined && RESCAN_DEVICE_ERROR_CODES.has(errorCode)) ||
    targetReusePolicy === 'rediscover'
  ) {
    return EThirdPartyHardwareRetryAction.restartDeviceSearch;
  }
  return EThirdPartyHardwareRetryAction.retrySelectedSearchTarget;
}
