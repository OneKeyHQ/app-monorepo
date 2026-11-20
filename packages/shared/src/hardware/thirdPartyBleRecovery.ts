import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '../../types/device';
import { ETranslations } from '../locale';

import { EThirdPartyHardwareRetryAction } from './thirdPartyHardwareRetry';

import type { IThirdPartyHardwareSearchTarget } from '../../types/device';

const RECOVERABLE_BLE_ERRORS = new Set<number>([
  HardwareErrorCode.DeviceNotFound,
  HardwareErrorCode.DeviceDisconnected,
  HardwareErrorCode.DeviceMismatch,
  HardwareErrorCode.DeviceSearchMismatch,
  HardwareErrorCode.OperationEnded,
  HardwareErrorCode.BlePairingTimeout,
  HardwareErrorCode.BleBondInvalid,
  HardwareErrorCode.BleConnectFailed,
  HardwareErrorCode.ThpPairingFailed,
  HardwareErrorCode.ThpPairingRequired,
]);

const REPAIRABLE_BLE_ERRORS = new Set<number>([
  HardwareErrorCode.BlePairingTimeout,
  HardwareErrorCode.BleConnectFailed,
  HardwareErrorCode.ThpPairingFailed,
  HardwareErrorCode.ThpPairingRequired,
]);

export function getThirdPartyBleRecoveryGuide({
  searchTarget,
  errorCode,
  retryAction,
}: {
  searchTarget: IThirdPartyHardwareSearchTarget | undefined;
  errorCode: number | undefined;
  retryAction: EThirdPartyHardwareRetryAction;
}): { steps: ETranslations[]; repairSteps?: ETranslations[] } | undefined {
  if (
    retryAction !== EThirdPartyHardwareRetryAction.restartDeviceSearch ||
    searchTarget?.connectionType !== 'ble' ||
    errorCode === undefined ||
    !RECOVERABLE_BLE_ERRORS.has(errorCode)
  ) {
    return undefined;
  }

  let prepareSteps: ETranslations[];
  if (searchTarget.vendor === EHardwareVendor.trezor) {
    prepareSteps = [
      ETranslations.trezor_ble_binding_guide_unlock__desc,
      ETranslations.trezor_ble_binding_guide_pair__desc,
    ];
  } else if (searchTarget.vendor === EHardwareVendor.ledger) {
    prepareSteps = [
      ETranslations.hardware_third_party_connect_step_power_on_and_unlock,
      ETranslations.bluetooth_enable_in_system_settings,
    ];
  } else {
    return undefined;
  }

  const repairSteps = [
    ETranslations.bluetooth_pairing_invalid__desc,
    ...prepareSteps,
  ];
  if (errorCode === HardwareErrorCode.BleBondInvalid) {
    return { steps: repairSteps };
  }
  return {
    steps: prepareSteps,
    repairSteps: REPAIRABLE_BLE_ERRORS.has(errorCode) ? repairSteps : undefined,
  };
}
