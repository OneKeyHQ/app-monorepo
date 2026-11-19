import { HardwareErrorCode } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '../../types/device';
import { ETranslations } from '../locale';

import { getThirdPartyBleRecoveryGuide } from './thirdPartyBleRecovery';
import { EThirdPartyHardwareRetryAction } from './thirdPartyHardwareRetry';

import type { IThirdPartyHardwareSearchTarget } from '../../types/device';

const target: IThirdPartyHardwareSearchTarget = {
  vendor: EHardwareVendor.trezor,
  connectionType: 'ble',
  searchTargetId: 'trezor-current-advertisement',
  searchTargetReusePolicy: 'current-discovery',
  kind: 'physical',
};

const restart = EThirdPartyHardwareRetryAction.restartDeviceSearch;

it('guides a confirmed invalid bond through system removal before pairing again', () => {
  expect(
    getThirdPartyBleRecoveryGuide({
      searchTarget: target,
      errorCode: HardwareErrorCode.BleBondInvalid,
      retryAction: restart,
    }),
  ).toEqual({
    steps: [
      ETranslations.bluetooth_pairing_invalid__desc,
      ETranslations.trezor_ble_binding_guide_unlock__desc,
      ETranslations.trezor_ble_binding_guide_pair__desc,
    ],
  });
});

it('offers normal rediscovery first and a separate bond repair guide for a generic failure', () => {
  const guide = getThirdPartyBleRecoveryGuide({
    searchTarget: target,
    errorCode: HardwareErrorCode.BleConnectFailed,
    retryAction: restart,
  });
  expect(guide?.steps).toEqual([
    ETranslations.trezor_ble_binding_guide_unlock__desc,
    ETranslations.trezor_ble_binding_guide_pair__desc,
  ]);
  expect(guide?.repairSteps?.[0]).toBe(
    ETranslations.bluetooth_pairing_invalid__desc,
  );
});

it('uses Ledger instructions for Ledger without showing Trezor pairing steps', () => {
  const guide = getThirdPartyBleRecoveryGuide({
    searchTarget: { ...target, vendor: EHardwareVendor.ledger },
    errorCode: HardwareErrorCode.BleConnectFailed,
    retryAction: restart,
  });
  expect(guide?.steps).toEqual([
    ETranslations.hardware_third_party_connect_step_power_on_and_unlock,
    ETranslations.bluetooth_enable_in_system_settings,
  ]);
});

it.each([
  EThirdPartyHardwareRetryAction.doNotRetry,
  EThirdPartyHardwareRetryAction.retrySelectedSearchTarget,
])(
  'preserves the existing %s decision without offering a new hardware retry',
  (retryAction) => {
    expect(
      getThirdPartyBleRecoveryGuide({
        searchTarget: target,
        errorCode: HardwareErrorCode.BleBondInvalid,
        retryAction,
      }),
    ).toBeUndefined();
  },
);

it('keeps USB, cancellation, permissions and unrelated failures out of BLE repair', () => {
  for (const errorCode of [
    HardwareErrorCode.UserAborted,
    HardwareErrorCode.BlePairingCancelled,
    HardwareErrorCode.DevicePermissionDenied,
    HardwareErrorCode.UnknownError,
  ]) {
    expect(
      getThirdPartyBleRecoveryGuide({
        searchTarget: target,
        errorCode,
        retryAction: restart,
      }),
    ).toBeUndefined();
  }
  expect(
    getThirdPartyBleRecoveryGuide({
      searchTarget: { ...target, connectionType: 'usb' },
      errorCode: HardwareErrorCode.BleBondInvalid,
      retryAction: restart,
    }),
  ).toBeUndefined();
});
