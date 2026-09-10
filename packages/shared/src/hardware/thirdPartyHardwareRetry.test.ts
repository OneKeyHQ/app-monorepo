import { HardwareErrorCode as ThirdPartyHwErrorCode } from '@onekeyfe/hwk-adapter-core';

import {
  EHardwareVendor,
  type IThirdPartyHardwareSearchTarget,
} from '@onekeyhq/shared/types/device';

import {
  THIRD_PARTY_HW_INTERACTION_ENDED_CODE,
  THIRD_PARTY_HW_INTERACTION_NOT_FOUND_CODE,
} from '../errors/errors/thirdPartyHardwareErrors';

import {
  EThirdPartyHardwareRetryAction,
  getThirdPartyHardwareRetryAction,
} from './thirdPartyHardwareRetry';

const trezorUsbTarget: IThirdPartyHardwareSearchTarget = {
  searchTargetId: 'trezor-usb',
  searchTargetReusePolicy: 'reconnectable',
  vendor: EHardwareVendor.trezor,
  connectionType: 'usb',
  kind: 'physical',
};

const ledgerUsbTarget: IThirdPartyHardwareSearchTarget = {
  searchTargetId: 'ledger-session',
  searchTargetReusePolicy: 'current-discovery',
  vendor: EHardwareVendor.ledger,
  connectionType: 'usb',
  kind: 'physical',
};

describe('third-party hardware retry policy', () => {
  it.each([
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
  ])('returns to discovery for connection-invalidating error %s', (code) => {
    expect(
      getThirdPartyHardwareRetryAction({
        errorCode: code,
        recovery: undefined,
        searchTarget: undefined,
      }),
    ).toBe(EThirdPartyHardwareRetryAction.restartDeviceSearch);
  });

  it.each([
    undefined,
    ThirdPartyHwErrorCode.DeviceLocked,
    ThirdPartyHwErrorCode.WrongApp,
    ThirdPartyHwErrorCode.DeviceAppStuck,
    ThirdPartyHwErrorCode.UserRejected,
    ThirdPartyHwErrorCode.DeviceBusy,
  ])('keeps the selected search target for device-action error %s', (code) => {
    expect(
      getThirdPartyHardwareRetryAction({
        errorCode: code,
        recovery: undefined,
        searchTarget: undefined,
      }),
    ).toBe(EThirdPartyHardwareRetryAction.retrySelectedSearchTarget);
  });

  it('uses SDK recovery metadata before the legacy error-code fallback', () => {
    expect(
      getThirdPartyHardwareRetryAction({
        errorCode: ThirdPartyHwErrorCode.DeviceDisconnected,
        recovery: { scope: 'operation' },
        searchTarget: trezorUsbTarget,
      }),
    ).toBe(EThirdPartyHardwareRetryAction.retrySelectedSearchTarget);
  });

  it('reconnects a persistent target after the interaction ends', () => {
    expect(
      getThirdPartyHardwareRetryAction({
        errorCode: ThirdPartyHwErrorCode.DeviceDisconnected,
        recovery: { scope: 'interaction' },
        searchTarget: trezorUsbTarget,
      }),
    ).toBe(EThirdPartyHardwareRetryAction.retrySelectedSearchTarget);
  });

  it('retries a current discovery target for a device-action failure', () => {
    expect(
      getThirdPartyHardwareRetryAction({
        errorCode: ThirdPartyHwErrorCode.DeviceLocked,
        recovery: { scope: 'operation' },
        searchTarget: ledgerUsbTarget,
      }),
    ).toBe(EThirdPartyHardwareRetryAction.retrySelectedSearchTarget);
  });

  it('rescans when a new interaction would require a current-discovery target', () => {
    expect(
      getThirdPartyHardwareRetryAction({
        errorCode: ThirdPartyHwErrorCode.DeviceDisconnected,
        recovery: { scope: 'interaction' },
        searchTarget: ledgerUsbTarget,
      }),
    ).toBe(EThirdPartyHardwareRetryAction.restartDeviceSearch);
  });

  it.each(['search-target', 'transport'] as const)(
    'rescans a stable target when SDK invalidates the %s scope',
    (scope) => {
      expect(
        getThirdPartyHardwareRetryAction({
          errorCode: ThirdPartyHwErrorCode.DeviceMismatch,
          recovery: { scope },
          searchTarget: trezorUsbTarget,
        }),
      ).toBe(EThirdPartyHardwareRetryAction.restartDeviceSearch);
    },
  );

  it('does not offer retry for a non-recoverable SDK failure', () => {
    expect(
      getThirdPartyHardwareRetryAction({
        errorCode: ThirdPartyHwErrorCode.InvalidParams,
        recovery: { scope: 'not-recoverable' },
        searchTarget: trezorUsbTarget,
      }),
    ).toBe(EThirdPartyHardwareRetryAction.doNotRetry);
  });

  it('uses the compatibility table when SDK recovery is unknown', () => {
    expect(
      getThirdPartyHardwareRetryAction({
        errorCode: ThirdPartyHwErrorCode.DeviceDisconnected,
        recovery: { scope: 'unknown' },
        searchTarget: trezorUsbTarget,
      }),
    ).toBe(EThirdPartyHardwareRetryAction.restartDeviceSearch);
  });

  it('rescans targets from an older SDK that omitted reuse metadata', () => {
    expect(
      getThirdPartyHardwareRetryAction({
        errorCode: ThirdPartyHwErrorCode.DeviceLocked,
        recovery: { scope: 'operation' },
        searchTarget: {
          ...ledgerUsbTarget,
          searchTargetReusePolicy: undefined,
        },
      }),
    ).toBe(EThirdPartyHardwareRetryAction.restartDeviceSearch);
  });
});
