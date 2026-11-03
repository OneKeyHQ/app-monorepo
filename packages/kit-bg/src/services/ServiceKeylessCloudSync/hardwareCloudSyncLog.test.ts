import {
  PinCancelled,
  UserCancel,
} from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import {
  HardwareCloudSyncCancelledError,
  HardwareCloudSyncUnlockError,
} from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  createHardwareCloudSyncDataError,
  isHardwareCloudSyncUserFacingError,
  logHardwareCloudSyncFailure,
  rethrowAsHardwareCloudSyncUnlockError,
} from './hardwareCloudSyncLog';

const mockLog = jest.fn<void, [string]>();
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: (message: string) => mockLog(message) } },
  },
}));

beforeEach(() => jest.clearAllMocks());

test('SDK failure logs exclude messages, request data and signatures', () => {
  logHardwareCloudSyncFailure('Device step failed', {
    name: 'HardwareTransportError',
    code: 101,
    message: 'synthetic-sensitive-message',
    request: { messageHex: 'synthetic-signing-request' },
    payload: { signature: 'synthetic-signature' },
  });
  expect(mockLog).toHaveBeenCalledWith(
    '[HardwareCloudSync] Device step failed: HardwareTransportError | 101',
  );
});

test('data errors show a translated message and log only the internal check', () => {
  const error = createHardwareCloudSyncDataError('Invalid key envelope');
  expect(error).toMatchObject({
    key: ETranslations.cloud_sync_data_unreadable__msg,
    reason: 'Invalid key envelope',
  });
  expect(error.message).not.toContain('Invalid key envelope');
  expect(mockLog).toHaveBeenCalledWith(
    '[HardwareCloudSync] Data check failed: Invalid key envelope',
  );
  expect(isHardwareCloudSyncUserFacingError(error)).toBe(true);
});

test('cancellation errors retain their message instead of becoming unlock errors', () => {
  for (const error of [
    new UserCancel(),
    new PinCancelled(),
    new HardwareCloudSyncCancelledError(),
  ]) {
    expect(isHardwareCloudSyncUserFacingError(error)).toBe(true);
  }
  expect(new HardwareCloudSyncCancelledError()).toMatchObject({
    key: ETranslations.update_operation_canceled,
  });
  expect(isHardwareCloudSyncUserFacingError({ code: 101 })).toBe(false);
});

test('device failures become one logged unlock error; known errors pass through', () => {
  const cancelled = new HardwareCloudSyncCancelledError();
  expect(() =>
    rethrowAsHardwareCloudSyncUnlockError('Device step failed', cancelled),
  ).toThrow(cancelled);
  const unlock = new HardwareCloudSyncUnlockError();
  expect(() =>
    rethrowAsHardwareCloudSyncUnlockError('Unlock failed', unlock),
  ).toThrow(unlock);
  expect(mockLog).not.toHaveBeenCalled();

  expect(() =>
    rethrowAsHardwareCloudSyncUnlockError('Device step failed', {
      name: 'HardwareTransportError',
      code: 101,
      message: 'synthetic-sensitive-message',
    }),
  ).toThrow(HardwareCloudSyncUnlockError);
  expect(mockLog).toHaveBeenCalledTimes(1);
  expect(mockLog).toHaveBeenCalledWith(
    '[HardwareCloudSync] Device step failed: HardwareTransportError | 101',
  );
});
