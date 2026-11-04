import { EFirmwareType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import { HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  callHardwareCloudSyncDevice,
  convertHardwareCloudSyncDeviceError,
  createHardwareCloudSyncDataError,
  logHardwareCloudSyncFailure,
  sanitizeHardwareCloudSyncDeviceError,
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
});
test('hardware errors retain their presentation without exporting signing data', () => {
  const original = convertDeviceError({
    code: HardwareErrorCode.ActionCancelled,
    error: 'Action cancelled',
  });
  const signature = 'ab'.repeat(65);
  const message = `${HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX}synthetic identity and key`;
  Object.assign(original, {
    payload: { ...original.payload, request: { message }, signature },
    data: { messageHex: Buffer.from(message).toString('hex'), signature },
    cause: { signature },
    unexpected: { signature },
  });
  const safe = sanitizeHardwareCloudSyncDeviceError(original);
  expect(Object.getPrototypeOf(safe)).toBe(Object.getPrototypeOf(original));
  expect(safe).toMatchObject({
    key: original.key,
    code: original.code,
    className: original.className,
    message: original.message,
    autoToast: original.autoToast,
  });
  const serialized = JSON.stringify(toPlainErrorObject(safe));
  expect(serialized).not.toContain(signature);
  expect(serialized).not.toContain(message);
  expect(serialized).not.toContain(Buffer.from(message).toString('hex'));
  expect(safe).not.toHaveProperty('data');
  expect(safe).not.toHaveProperty('cause');
  expect(safe).not.toHaveProperty('unexpected');
  expect(safe).not.toHaveProperty('stack');
});

test('a thrown SDK error uses the common converter and redacts free-text material', () => {
  const sdkError = Object.assign(
    new Error(`Device failed: ${'ab'.repeat(65)}`),
    {
      errorCode: HardwareErrorCode.ActionCancelled,
      data: { signature: 'private' },
    },
  );
  const safe = sanitizeHardwareCloudSyncDeviceError(sdkError);
  expect(safe).toMatchObject({
    key: convertDeviceError({ code: sdkError.errorCode }).key,
    payload: { code: sdkError.errorCode },
  });
  expect(JSON.stringify(toPlainErrorObject(safe))).not.toContain(
    'ab'.repeat(65),
  );
  expect(safe).not.toHaveProperty('data');
});

test('SDK payload identifiers are omitted and only the trusted operation connection is kept', () => {
  const sensitive = `${HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX}synthetic signing content`;
  const original = convertDeviceError({
    code: HardwareErrorCode.ActionCancelled,
  });
  Object.assign(original, {
    payload: {
      ...original.payload,
      connectId: sensitive,
      deviceId: sensitive,
      appName: sensitive,
      recovery: { scope: sensitive },
    },
  });
  const safe = sanitizeHardwareCloudSyncDeviceError(
    original,
    'trusted-connection',
  );
  expect(safe.payload?.connectId).toBe('trusted-connection');
  expect(safe.payload?.recovery).toBeUndefined();
  expect(safe.payload).not.toHaveProperty('deviceId');
  expect(safe.payload).not.toHaveProperty('appName');
  expect(JSON.stringify(toPlainErrorObject(safe))).not.toContain(sensitive);
  expect(
    sanitizeHardwareCloudSyncDeviceError(original).payload?.connectId,
  ).toBeUndefined();
});

test('failed responses retain the common presentation and normalized recovery hint', () => {
  const payload = {
    code: HardwareErrorCode.ActionCancelled,
    error: 'Action cancelled',
    connectId: 'untrusted-response-id',
    recovery: { scope: 'operation' as const },
  };
  const safe = convertHardwareCloudSyncDeviceError(payload, 'selected-id');
  const common = convertDeviceError({ ...payload, connectId: 'selected-id' });
  expect(Object.getPrototypeOf(safe)).toBe(Object.getPrototypeOf(common));
  expect(safe).toMatchObject({
    key: common.key,
    code: common.code,
    payload: { connectId: 'selected-id', recovery: { scope: 'operation' } },
  });
});

test.each([
  {
    code: HardwareErrorCode.CallMethodNeedUpgradeFirmware,
    error: 'Firmware too low',
    params: { require: '1.2.3' },
  },
  {
    code: HardwareErrorCode.RuntimeError,
    error: 'Unknown message',
    params: { firmwareType: EFirmwareType.BitcoinOnly },
  },
])(
  'preserves common firmware presentation for response and thrown code $code',
  (payload) => {
    const common = convertDeviceError(payload);
    const returned = convertHardwareCloudSyncDeviceError(payload, 'trusted-id');
    const thrown = sanitizeHardwareCloudSyncDeviceError(
      Object.assign(new Error(payload.error), {
        errorCode: payload.code,
        params: payload.params,
      }),
      'trusted-id',
    );
    for (const safe of [returned, thrown]) {
      expect(safe).toMatchObject({
        key: common.key,
        code: common.code,
        info: common.info,
      });
      expect(safe.payload).not.toHaveProperty('params');
    }
  },
);

test('arbitrary SDK params cannot be copied into translated firmware information', () => {
  const sensitive = `${HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX}synthetic key material`;
  const safe = convertHardwareCloudSyncDeviceError({
    code: HardwareErrorCode.CallMethodNeedUpgradeFirmware,
    params: { require: sensitive },
  });
  expect(JSON.stringify(safe)).not.toContain(sensitive);
});

test('thrown SDK errors retain the common silent-mode behavior', async () => {
  const emit = jest.spyOn(appEventBus, 'emit');
  try {
    const sdkError = Object.assign(new Error('Device not found'), {
      errorCode: HardwareErrorCode.DeviceNotFound,
    });
    const expected = convertDeviceError(
      { code: sdkError.errorCode, error: sdkError.message },
      { silentMode: true },
    );
    await expect(
      callHardwareCloudSyncDevice(
        async () => {
          throw sdkError;
        },
        'selected-id',
        { silentMode: true },
      ),
    ).rejects.toMatchObject({ key: expected.key, code: expected.code });
    expect(emit).not.toHaveBeenCalled();
  } finally {
    emit.mockRestore();
  }
});
