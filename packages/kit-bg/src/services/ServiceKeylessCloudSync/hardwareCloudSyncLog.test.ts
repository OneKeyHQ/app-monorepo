import {
  PinCancelled,
  UserCancel,
} from '@onekeyhq/shared/src/errors/errors/hardwareErrors';
import { HardwareCloudSyncLocalError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  createHardwareCloudSyncDataError,
  isHardwareCloudSyncUserFacingError,
  logHardwareCloudSyncFailure,
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
    new HardwareCloudSyncLocalError(
      ETranslations.update_operation_canceled,
      'Operation canceled',
    ),
  ]) {
    expect(isHardwareCloudSyncUserFacingError(error)).toBe(true);
  }
  expect(isHardwareCloudSyncUserFacingError({ code: 101 })).toBe(false);
});
