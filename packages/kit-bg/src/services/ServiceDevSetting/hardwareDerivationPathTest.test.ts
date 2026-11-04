import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  HARDWARE_PATH_TEST_MESSAGE,
  HARDWARE_PATH_TEST_PRESETS,
} from '@onekeyhq/shared/src/consts/hardwareDerivationPathTest';
import type { IHardwarePathTestRequest } from '@onekeyhq/shared/src/consts/hardwareDerivationPathTest';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';

import { runHardwareDerivationPathTest } from './hardwareDerivationPathTest';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';
import type { IOneKeyHardwareOperationLease } from '../ServiceHardwareUI/HardwareProcessingManager';
import type { CoreApi } from '@onekeyfe/hd-core';

function setup() {
  const abort = new AbortController();
  const lease: IOneKeyHardwareOperationLease = {
    owner: Symbol('path-test'),
    deviceKey: 'selected-device',
    signal: abort.signal,
  };
  const sdk = {
    openWalletSession: jest.fn(async () => ({
      success: true,
      payload: {
        walletType: 'standard',
        deviceId: 'device-id',
        passphraseState: null,
      },
    })),
    btcSignMessage: jest.fn<
      ReturnType<CoreApi['btcSignMessage']>,
      Parameters<CoreApi['btcSignMessage']>
    >(async () => ({
      success: true,
      payload: {
        address: 'synthetic-wallet-address',
        signature: 'ab'.repeat(65),
      },
    })),
    btcGetAddress: jest.fn(async () => ({
      success: true,
      payload: { address: 'synthetic-wallet-address' },
    })),
    btcGetPublicKey: jest.fn(async () => ({
      success: true,
      payload: { node: { public_key: 'synthetic-public-key' } },
    })),
  };
  const hardware = {
    getCompatibleConnectId: jest.fn(async () => 'resolved-device'),
    getSDKInstance: jest.fn(async () => sdk),
    getDeviceState: jest.fn(async () => ({
      identity: { deviceType: 'classic1s', firmwareType: 'btc-only' },
      protocol: 'V1',
      versions: { firmware: '3.21.0' },
    })),
    cancel: jest.fn(async () => undefined),
  };
  const ui = {
    hardwareProcessingManager: {
      cancelOneKeyOperation: jest.fn(() => abort.abort()),
    },
    tryRunExclusiveOneKeyOperation: jest.fn(
      async <T>(
        operation: (active: IOneKeyHardwareOperationLease) => Promise<T>,
      ) => ({
        acquired: true,
        result: await operation(lease),
      }),
    ),
  };
  const backgroundApi = {
    serviceHardware: hardware,
    serviceHardwareUI: ui,
  } as unknown as IBackgroundApi;
  const request: IHardwarePathTestRequest = {
    testId: 'test',
    connectId: 'selected-device',
    path: HARDWARE_PATH_TEST_PRESETS[0].path,
    method: 'btcSignMessage',
    signType: 'default',
  };
  const onCancelChange = jest.fn<void, [(() => void) | undefined]>();
  return {
    abort,
    lease,
    sdk,
    hardware,
    ui,
    backgroundApi,
    request,
    onCancelChange,
  };
}

test.each(HARDWARE_PATH_TEST_PRESETS)(
  'passes $label to the SDK without enforcing firmware limits in the App',
  async ({ path }) => {
    const test = setup();
    test.request.path = path;
    const result = await runHardwareDerivationPathTest(test);
    expect(test.sdk.btcSignMessage).toHaveBeenCalledWith(
      'resolved-device',
      'device-id',
      {
        path,
        coin: 'Bitcoin',
        useEmptyPassphrase: true,
        messageHex: Buffer.from(HARDWARE_PATH_TEST_MESSAGE).toString('hex'),
      },
    );
    expect(result).toMatchObject({
      success: true,
      path,
      signatureBytes: 65,
      device: { firmware: '3.21.0' },
    });
    expect(result).not.toHaveProperty('signature');
    expect(result).not.toHaveProperty('address');
    expect(test.onCancelChange).toHaveBeenLastCalledWith(undefined);
  },
);

test.each(['btcGetPublicKey', 'btcGetAddress'] as const)(
  'calls only the selected method %s',
  async (method) => {
    const test = setup();
    test.request.method = method;
    await runHardwareDerivationPathTest(test);
    expect(test.sdk[method]).toHaveBeenCalledTimes(1);
    expect(test.sdk.btcSignMessage).not.toHaveBeenCalled();
  },
);

test.each(['ecdsa', 'bip322-simple'] as const)(
  'forwards the selected signing format %s',
  async (signType) => {
    const test = setup();
    test.request.signType = signType;
    await runHardwareDerivationPathTest(test);
    expect(test.sdk.btcSignMessage).toHaveBeenCalledWith(
      'resolved-device',
      'device-id',
      expect.objectContaining({ dAppSignType: signType }),
    );
  },
);

test.each([
  "m/44'/0'/2147483648'/0/0",
  "m/44'/0'/-1'/0/0",
  "m/44''/0'/0'/0/0",
  "m/44'/0'/0'/0/1'1",
  'm//0',
  'invalid',
])(
  'rejects malformed BIP32 path %s before device interaction',
  async (path) => {
    const test = setup();
    test.request.path = path;
    await expect(runHardwareDerivationPathTest(test)).rejects.toThrow(
      'valid BIP32 path',
    );
    expect(test.hardware.getSDKInstance).not.toHaveBeenCalled();
  },
);

test('uses the common hardware error for device refusal and clears the canceller', async () => {
  const test = setup();
  const payload = {
    code: HardwareErrorCode.ActionCancelled,
    error: 'Action cancelled',
  };
  test.sdk.btcSignMessage.mockResolvedValueOnce({ success: false, payload });
  await expect(runHardwareDerivationPathTest(test)).rejects.toMatchObject(
    convertDeviceError(payload),
  );
  expect(test.onCancelChange).toHaveBeenLastCalledWith(undefined);
});

test('cancels only its lease and does not sign after cancellation', async () => {
  const test = setup();
  test.hardware.getCompatibleConnectId.mockImplementationOnce(async () => {
    test.onCancelChange.mock.calls[0][0]?.();
    return 'resolved-device';
  });
  await expect(runHardwareDerivationPathTest(test)).rejects.toBeDefined();
  expect(
    test.ui.hardwareProcessingManager.cancelOneKeyOperation,
  ).toHaveBeenCalledWith(test.lease);
  expect(test.hardware.cancel).toHaveBeenCalledWith({
    connectId: 'selected-device',
    oneKeyOperationLease: test.lease,
    immediate: true,
  });
  expect(test.sdk.btcSignMessage).not.toHaveBeenCalled();
});
