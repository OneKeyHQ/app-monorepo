import { HardwareErrorCode as HwkCode } from '@onekeyfe/hwk-adapter-core';

import {
  EThirdPartyHardwareRetryAction,
  getThirdPartyHardwareRetryAction,
} from '@onekeyhq/shared/src/hardware/thirdPartyHardwareRetry';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IThirdPartyHardwareSearchTarget } from '@onekeyhq/shared/types/device';

import type { IBleTestFailure } from './bleTestLog';

export function shouldRefreshBleTestTarget(
  target: IThirdPartyHardwareSearchTarget,
  failure: IBleTestFailure,
): boolean {
  if (
    target.vendor !== EHardwareVendor.trezor ||
    target.connectionType !== 'ble' ||
    target.searchTargetReusePolicy !== 'current-discovery'
  ) {
    return false;
  }
  if (
    failure.code === HwkCode.OperationEnded &&
    failure.params?.reason !== 'disconnect'
  ) {
    return false;
  }
  return (
    getThirdPartyHardwareRetryAction({
      errorCode: failure.code,
      recovery: undefined,
      searchTarget: target,
    }) === EThirdPartyHardwareRetryAction.restartDeviceSearch
  );
}
