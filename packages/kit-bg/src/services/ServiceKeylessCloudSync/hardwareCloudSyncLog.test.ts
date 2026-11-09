import { EFirmwareType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import { HARDWARE_CLOUD_SYNC_MESSAGE_PREFIX } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  callHardwareCloudSyncDevice,
  convertHardwareCloudSyncDeviceError,
  createHardwareCloudSyncDataError,
  createHardwareCloudSyncDiagnostic,
  getHardwareCloudSyncErrorDiagnostics,
  logHardwareCloudSyncDiagnostic,
  logHardwareCloudSyncFailure,
  sanitizeHardwareCloudSyncDeviceError,
  summarizeHardwareCloudSyncRestoreItems,
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

test('device diagnostics retain compatibility fields without copying SDK data', () => {
  const context = {
    deviceType: 'touch',
    firmwareVersion: '4.9.0',
    protocol: 'V1',
    unlocked: true,
    passphraseProtection: false,
    unlockedAttachPin: null,
    deviceIdMatches: true,
    serialNo: 'synthetic-private-serial',
    address: 'synthetic-private-address',
    signature: 'synthetic-private-signature',
  };
  logHardwareCloudSyncFailure(
    'Standard wallet check',
    'Invalid state',
    context,
  );
  expect(mockLog).toHaveBeenCalledWith(
    '[HardwareCloudSync] Standard wallet check: Invalid state | {"deviceType":"touch","firmwareVersion":"4.9.0","protocol":"V1","unlocked":true,"passphraseProtection":false,"unlockedAttachPin":null,"deviceIdMatches":true}',
  );
});

test('device diagnostics reject arbitrary model and firmware strings', () => {
  logHardwareCloudSyncFailure('Device step', 'Invalid state', {
    deviceType: 'synthetic-private-model',
    firmwareVersion: 'synthetic-private-firmware',
    protocol: 'synthetic-private-protocol',
  });
  expect(mockLog).toHaveBeenCalledWith(
    '[HardwareCloudSync] Device step: Invalid state',
  );
});

test('device failure diagnostics retain SDK codes and known path refusals', () => {
  const signature = 'ab'.repeat(65);
  logHardwareCloudSyncFailure('btcSignMessage.auth', {
    className: 'OneKeyHardwareError',
    code: 803,
    payload: {
      code: 800,
      error: 'Failure_DataError,Forbidden key path',
      signature,
    },
    message: signature,
    request: { messageHex: signature },
  });
  expect(mockLog).toHaveBeenCalledWith(
    '[HardwareCloudSync] btcSignMessage.auth: OneKeyHardwareError | 803 | sdkCode=800 | Forbidden key path',
  );
});

test('a diagnostic sink failure cannot replace the hardware error', () => {
  mockLog.mockImplementationOnce(() => {
    throw new OneKeyLocalError('Synthetic log sink failure');
  });
  expect(() =>
    logHardwareCloudSyncFailure('Device step', { code: 105 }),
  ).not.toThrow();
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

test.each([
  HardwareErrorCode.DeviceCheckUnlockTypeError,
  HardwareErrorCode.DeviceCheckPassphraseStateError,
  HardwareErrorCode.PinInvalid,
  HardwareErrorCode.DeviceNotFound,
])(
  'raw numeric SDK code %s retains the shared error type and translation',
  (code) => {
    const common = convertDeviceError(
      { code, error: 'Synthetic device refusal' },
      { silentMode: true },
    );
    const safe = sanitizeHardwareCloudSyncDeviceError(
      { code, message: 'Synthetic device refusal' },
      'selected-id',
      { silentMode: true },
    );
    expect(Object.getPrototypeOf(safe)).toBe(Object.getPrototypeOf(common));
    expect(safe).toMatchObject({
      code: common.code,
      key: common.key,
      $isHardwareError: true,
    });
  },
);

test('sync diagnostics allow only fixed stages and safe aggregate values', () => {
  logHardwareCloudSyncDiagnostic('history_received_completeness_unknown', {
    returnedCount: 260,
    invalidEnvelopeCount: 1,
    historyCompleteKnown: false,
    token: 'private-token',
    dekId: 'private-dek-id',
    pwdHash: 'private-pwd-hash',
    wrappedDek: 'private-wrapped-key',
    error: { message: 'private-error' },
    generation: 'private-generation',
    page: NaN,
    start: -1,
  });
  expect(mockLog).toHaveBeenLastCalledWith(
    '[HardwareCloudSyncDiagnostic] history_received_completeness_unknown {"historyCompleteKnown":false,"returnedCount":260,"invalidEnvelopeCount":1}',
  );
  logHardwareCloudSyncDiagnostic('private_secret_value', { returnedCount: 1 });
  expect(mockLog).toHaveBeenCalledTimes(1);
});

test('diagnostics failure never replaces the operation or propagates an error', () => {
  mockLog.mockImplementationOnce(() => {
    throw new OneKeyLocalError('logger failed');
  });
  expect(() =>
    logHardwareCloudSyncDiagnostic('request_failed', { unauthorized: true }),
  ).not.toThrow();
});

test('diagnostic correlation lasts only for a new operation', () => {
  const first = createHardwareCloudSyncDiagnostic();
  const second = createHardwareCloudSyncDiagnostic();
  first('request_download');
  first('request_failed');
  second('request_download');
  const ids = mockLog.mock.calls.map(
    ([line]) =>
      (JSON.parse(line.slice(line.indexOf('{'))) as { operationId?: string })
        .operationId,
  );
  expect(ids[0]).toMatch(/^[a-zA-Z0-9]{12}$/);
  expect(ids[1]).toBe(ids[0]);
  expect(ids[2]).not.toBe(ids[0]);
});

test('error diagnostics classify codes without exposing server explanations or Axios config', () => {
  expect(
    getHardwareCloudSyncErrorDiagnostics({
      code: 90_700,
      message: 'private-message',
      response: { status: 401, data: 'private-body' },
      config: { headers: { Authorization: 'private-token' } },
    }),
  ).toEqual({
    businessCode: 90_700,
    httpStatus: 401,
    transportFailure: false,
    timeout: false,
  });
  expect(
    getHardwareCloudSyncErrorDiagnostics({ code: 'ETIMEDOUT' }),
  ).toMatchObject({ timeout: true });
  expect(
    getHardwareCloudSyncErrorDiagnostics({ code: 'ERR_NETWORK' }),
  ).toMatchObject({ transportFailure: true });
  expect(
    getHardwareCloudSyncErrorDiagnostics({
      code: 'private-token',
      response: { status: 'private-data' },
    }),
  ).toEqual({
    businessCode: undefined,
    httpStatus: undefined,
    transportFailure: false,
    timeout: false,
  });
});

test('restore diagnostics classify mismatched tombstones and locks without exposing their values', () => {
  const items = [
    { pwdHash: 'private-old', dataType: 'Lock', isDeleted: false },
    { pwdHash: 'private-old', dataType: 'Wallet', isDeleted: true },
    {
      pwdHash: 'private-old',
      dataType: 'HardwareCloudSyncKeyEnvelope',
      isDeleted: true,
    },
    { pwdHash: 'private-old', dataType: 'IndexedAccount', isDeleted: false },
    {
      pwdHash: 'private-old',
      dataType: 'private-unknown-type',
      isDeleted: true,
    },
    { pwdHash: 'private-known', dataType: 'Wallet', isDeleted: true },
    { pwdHash: '', dataType: 'Lock', isDeleted: true },
  ];
  const summary = summarizeHardwareCloudSyncRestoreItems(
    items,
    new Set(['private-known']),
  );
  expect(summary).toMatchObject({
    mismatchedItemCount: 5,
    mismatchedDeletedCount: 3,
    mismatchedLiveCount: 2,
    mismatchedLockCount: 1,
    mismatchedDeletedLockCount: 0,
    mismatchedWalletCount: 1,
    mismatchedDeletedWalletCount: 1,
    mismatchedEnvelopeCount: 1,
    mismatchedDeletedEnvelopeCount: 1,
    mismatchedAccountCount: 1,
    mismatchedOtherCount: 1,
    mismatchedDeletedOtherCount: 1,
  });
  logHardwareCloudSyncDiagnostic('restore_key_compatibility_guard', {
    ...summary,
    existingSigningPublicKeyEmpty: true,
    currentSigningPublicKeyEmpty: false,
  });
  const logs = JSON.stringify(mockLog.mock.calls);
  expect(mockLog.mock.calls[0][0]).toContain('mismatchedDeletedOtherCount');
  expect(logs).not.toContain('private-');
});

test('diagnostic-only aggregation failures do not escape', () => {
  expect(() =>
    logHardwareCloudSyncDiagnostic('restore_key_compatibility_guard', () => {
      throw new OneKeyLocalError('private-error');
    }),
  ).not.toThrow();
});
