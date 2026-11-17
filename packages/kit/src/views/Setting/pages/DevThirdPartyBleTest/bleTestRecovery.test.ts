import { HardwareErrorCode as HwkCode } from '@onekeyfe/hwk-adapter-core';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';
import type { IThirdPartyHardwareSearchTarget } from '@onekeyhq/shared/types/device';

import { shouldRefreshBleTestTarget } from './bleTestRecovery';

const target: IThirdPartyHardwareSearchTarget = {
  vendor: EHardwareVendor.trezor,
  connectionType: 'ble',
  searchTargetId: 'old-pairing-session',
  searchTargetReusePolicy: 'current-discovery',
  kind: 'physical',
};

it.each([
  HwkCode.DeviceNotFound,
  HwkCode.DeviceDisconnected,
  HwkCode.BleConnectFailed,
  HwkCode.BlePairingTimeout,
])('refreshes the ephemeral Trezor target after %s', (code) => {
  expect(shouldRefreshBleTestTarget(target, { code, message: 'failed' })).toBe(
    true,
  );
});

it('refreshes a disconnected operation while leaving explicit release alone', () => {
  expect(
    shouldRefreshBleTestTarget(target, {
      code: HwkCode.OperationEnded,
      message: 'ended',
      params: { reason: 'disconnect' },
    }),
  ).toBe(true);
  expect(
    shouldRefreshBleTestTarget(target, {
      code: HwkCode.OperationEnded,
      message: 'ended',
      params: { reason: 'explicit' },
    }),
  ).toBe(false);
});

it.each([
  HwkCode.UserAborted,
  HwkCode.BlePairingCancelled,
  HwkCode.DevicePermissionDenied,
  HwkCode.UnknownError,
])(
  'does not restart discovery after cancellation or unrelated failure %s',
  (code) => {
    expect(
      shouldRefreshBleTestTarget(target, { code, message: 'failed' }),
    ).toBe(false);
  },
);

it('does not apply Trezor discovery recovery to Ledger, USB or a reconnectable target', () => {
  const failure = { code: HwkCode.DeviceDisconnected, message: 'disconnected' };
  expect(
    shouldRefreshBleTestTarget(
      { ...target, vendor: EHardwareVendor.ledger },
      failure,
    ),
  ).toBe(false);
  expect(
    shouldRefreshBleTestTarget({ ...target, connectionType: 'usb' }, failure),
  ).toBe(false);
  expect(
    shouldRefreshBleTestTarget(
      { ...target, searchTargetReusePolicy: 'reconnectable' },
      failure,
    ),
  ).toBe(false);
});
