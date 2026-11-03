import { testHardwareCipherKeyValue } from './hardwareCipherKeyValueTest';

import type { IBackgroundApi } from '../apis/IBackgroundApi';
import type {
  CipheredKeyValue,
  CipheredKeyValueParams,
  Success,
  Unsuccessful,
} from '@onekeyfe/hd-core';

jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: { getDeviceByQuery: jest.fn(async () => undefined) },
}));
jest.mock('@onekeyhq/shared/src/utils/deviceUtils', () => ({
  __esModule: true,
  default: {
    getDeviceTypeFromFeatures: async () => 'classic1s',
    getDeviceVersion: async () => ({ firmwareVersion: '3.21.0' }),
  },
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/errors/utils/deviceErrorUtils', () => ({
  convertDeviceResponse: async (
    operation: () => Promise<Success<unknown> | Unsuccessful>,
  ) => {
    const { OneKeyLocalError } = jest.requireMock<
      typeof import('@onekeyhq/shared/src/errors')
    >('@onekeyhq/shared/src/errors');
    const result = await operation();
    if (!result.success) throw new OneKeyLocalError(result.payload.error);
    return result.payload;
  },
}));

const input = '000102030405060708090a0b0c0d0e0f';
const ciphertext = 'ffeeddccbbaa99887766554433221100';
const key = 'OneKey CipherKeyValue DEV TEST';

function setup() {
  const abort = new AbortController();
  const cipher = jest.fn<
    Promise<Success<CipheredKeyValue> | Unsuccessful>,
    [string, string, CipheredKeyValueParams]
  >(async (_connectId, _deviceId, params) => ({
    success: true,
    payload: {
      value: params.encrypt ? ciphertext : input,
      path: "m/10016'/0'",
    },
  }));
  const sdk = {
    openWalletSession: jest.fn(async () => ({
      success: true,
      payload: { deviceId: 'test-device', walletType: 'standard' },
    })),
    cipherKeyValue: cipher,
  };
  const hardware = {
    getCompatibleConnectId: jest.fn(async () => 'compatible-id'),
    getFeaturesWithoutCache: jest.fn(async () => ({
      major_version: 3,
      minor_version: 21,
      patch_version: 0,
    })),
    getSDKInstance: jest.fn(async () => sdk),
  };
  // Only the hardware services used by this diagnostic are needed here.
  const api = {
    serviceHardware: hardware,
    serviceHardwareUI: {
      withHardwareProcessing: async <T>(
        operation: (lease: { signal: AbortSignal }) => Promise<T>,
      ) => operation({ signal: abort.signal }),
    },
  } as unknown as IBackgroundApi;
  return { api, cipher, sdk, hardware, abort };
}

test('verifies the SDK round trip with confirmation flags fixed in both directions', async () => {
  const { api, cipher } = setup();
  const result = await testHardwareCipherKeyValue(api, {
    connectId: 'selected-id',
    key,
  });
  expect(cipher.mock.calls.map((call) => call[2])).toEqual([
    expect.objectContaining({ value: input, encrypt: true }),
    expect.objectContaining({ value: input, encrypt: true }),
    expect.objectContaining({ value: ciphertext, encrypt: false }),
  ]);
  for (const call of cipher.mock.calls) {
    expect(call).toEqual([
      'compatible-id',
      'test-device',
      expect.objectContaining({
        key,
        path: "m/10016'/0'",
        askOnEncrypt: true,
        askOnDecrypt: true,
        useEmptyPassphrase: true,
      }),
    ]);
  }
  expect(result).toMatchObject({
    deterministic: true,
    roundTrip: true,
    firmwareVersion: '3.21.0',
    outputBytes: 16,
  });
  expect(JSON.stringify(result)).not.toContain(ciphertext);
  expect(JSON.stringify(result)).not.toContain('test-device');
});

test('reports nondeterminism without treating it as a pass', async () => {
  const { api, cipher } = setup();
  cipher.mockResolvedValueOnce({
    success: true,
    payload: { value: input, path: "m/10016'/0'" },
  });
  const result = await testHardwareCipherKeyValue(api, {
    connectId: 'selected-id',
    key,
  });
  expect(result.deterministic).toBe(false);
});

test('stops on a device rejection instead of sending remaining requests', async () => {
  const { api, cipher } = setup();
  cipher.mockResolvedValueOnce({
    success: false,
    payload: { error: 'Failure_ActionCancelled', code: 400 },
  });
  await expect(
    testHardwareCipherKeyValue(api, { connectId: 'selected-id', key }),
  ).rejects.toThrow('Failure_ActionCancelled');
  expect(cipher).toHaveBeenCalledTimes(1);
});

test('rejects malformed device output before passing it to decryption', async () => {
  const { api, cipher } = setup();
  cipher.mockResolvedValueOnce({
    success: true,
    payload: { value: 'x', path: "m/10016'/0'" },
  });
  await expect(
    testHardwareCipherKeyValue(api, { connectId: 'selected-id', key }),
  ).rejects.toThrow('invalid test data');
  expect(cipher).toHaveBeenCalledTimes(1);
});

test('does not issue a cipher request after the hardware operation is cancelled', async () => {
  const { api, cipher, sdk, abort } = setup();
  sdk.openWalletSession.mockImplementationOnce(async () => {
    abort.abort();
    return {
      success: true,
      payload: { deviceId: 'test-device', walletType: 'standard' },
    };
  });
  await expect(
    testHardwareCipherKeyValue(api, { connectId: 'selected-id', key }),
  ).rejects.toThrow('cancelled');
  expect(cipher).not.toHaveBeenCalled();
});

test.each(['', ' ', 'x'.repeat(513)])(
  'rejects invalid key text before accessing hardware',
  async (invalidKey) => {
    const { api, hardware } = setup();
    await expect(
      testHardwareCipherKeyValue(api, {
        connectId: 'selected-id',
        key: invalidKey,
      }),
    ).rejects.toThrow('1–512');
    expect(hardware.getSDKInstance).not.toHaveBeenCalled();
  },
);
