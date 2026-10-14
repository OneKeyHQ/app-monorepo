import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import {
  ORPHAN_ELIGIBLE_ERROR_CODES,
  HardwareErrorCode as ThirdPartyHwErrorCode,
} from '@onekeyfe/hwk-adapter-core/errors';

import {
  IncorrectPassword,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import { shouldAbortAccountCreation } from './accountCreationErrors';

describe('account creation abort policy', () => {
  it.each([
    EOneKeyErrorClassNames.IncorrectPassword,
    EOneKeyErrorClassNames.IncorrectPinError,
    EOneKeyErrorClassNames.IncorrectMasterPassword,
    EOneKeyErrorClassNames.WrongPassword,
    EOneKeyErrorClassNames.PasswordPromptDialogCancel,
    EOneKeyErrorClassNames.OneKeyAbortError,
    EOneKeyErrorClassNames.PrimeTransferImportCancelledError,
    EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
    EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
    EOneKeyErrorClassNames.HardwareUserCancelFromOutside,
    EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
    EOneKeyErrorClassNames.LocalDbOpenError,
  ])('aborts serialized %s', (className) => {
    expect(shouldAbortAccountCreation({ className })).toBe(true);
  });

  it('also recognizes a local password error instance', () => {
    expect(shouldAbortAccountCreation(new IncorrectPassword())).toBe(true);
  });

  it.each([
    HardwareErrorCode.PinInvalid,
    HardwareErrorCode.PinCancelled,
    HardwareErrorCode.ActionCancelled,
    HardwareErrorCode.DeviceNotFound,
    HardwareErrorCode.BridgeDeviceDisconnected,
    HardwareErrorCode.WebDeviceNotFoundOrNeedsPermission,
    HardwareErrorCode.BridgeNeedsPermission,
    HardwareErrorCode.BlePermissionError,
    HardwareErrorCode.BleDeviceDisconnected,
    ThirdPartyHwErrorCode.PinInvalid,
    ThirdPartyHwErrorCode.PinCancelled,
    ThirdPartyHwErrorCode.PassphraseRejected,
    ...ORPHAN_ELIGIBLE_ERROR_CODES,
  ])('preserves hardware abort code %s across serialization', (code) => {
    expect(
      shouldAbortAccountCreation({
        className: EOneKeyErrorClassNames.OneKeyHardwareError,
        payload: { code },
      }),
    ).toBe(true);
  });

  it('does not classify a non-hardware error by a colliding numeric code', () => {
    expect(
      shouldAbortAccountCreation({
        className: EOneKeyErrorClassNames.OneKeyLocalError,
        code: HardwareErrorCode.ActionCancelled,
      }),
    ).toBe(false);
  });

  it('allows a chain-specific hardware limitation to be skipped', () => {
    expect(
      shouldAbortAccountCreation({
        $isHardwareError: true,
        code: ThirdPartyHwErrorCode.ChainNotSupported,
      }),
    ).toBe(false);
  });
});

it.each([
  HardwareErrorCode.BleTimeoutError,
  HardwareErrorCode.BridgeNetworkError,
  HardwareErrorCode.TransportNotFound,
  ThirdPartyHwErrorCode.DeviceLocked,
  ThirdPartyHwErrorCode.OperationTimeout,
  ThirdPartyHwErrorCode.TransportNotAvailable,
  999_999,
])(
  'aborts device state, transport and unknown hardware errors (%s)',
  (code) => {
    expect(shouldAbortAccountCreation({ $isHardwareError: true, code })).toBe(
      true,
    );
  },
);

it('does not retry a deliberately masked authorization failure', () => {
  expect(
    shouldAbortAccountCreation(new OneKeyLocalError('Unknown error')),
  ).toBe(true);
});
