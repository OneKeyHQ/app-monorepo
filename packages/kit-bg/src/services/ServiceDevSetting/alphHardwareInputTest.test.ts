import { addressFromPublicKey, codec } from '@alephium/web3';
import { EDeviceType, HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  buildAlphHardwareInputTestTx,
  runAlphHardwareInputTest,
} from './alphHardwareInputTest';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

// Public secp256k1 generator point, not a user's account.
const publicKey =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const accountId = "hw-test--m/44'/1234'/0'";
const path = "m/44'/1234'/0'";

describe('ALPH hardware input test fixture', () => {
  it.each([1, 16, 17, 32, 64, 256])(
    'encodes %i distinct inputs for a self transfer',
    (inputCount) => {
      const rawTx = buildAlphHardwareInputTestTx({ publicKey, inputCount });
      const decoded = codec.unsignedTxCodec.decode(Buffer.from(rawTx, 'hex'));
      expect(decoded.inputs).toHaveLength(inputCount);
      expect(
        new Set(
          decoded.inputs.map((input) => Buffer.from(input.key).toString('hex')),
        ).size,
      ).toBe(inputCount);
      expect(decoded.inputs[0].unlockScript).toEqual({
        kind: 'P2PKH',
        value: Buffer.from(publicKey, 'hex'),
      });
      expect(
        decoded.inputs.every((input) => input.unlockScript.kind === 'P2PKH'),
      ).toBe(true);
      expect(decoded.statefulScript.kind).toBe('None');
      const output = codec.assetOutput.AssetOutputCodec.toFixedAssetOutput(
        new Uint8Array(32),
        decoded.fixedOutputs[0],
        0,
      );
      expect(output.address).toBe(addressFromPublicKey(publicKey));
      expect(decoded.inputs.every((input) => input.hint === output.hint)).toBe(
        true,
      );
    },
  );

  it.each([0, -1, 1.5, 257, Number.NaN])(
    'rejects invalid fixture size %s',
    (inputCount) => {
      expect(() =>
        buildAlphHardwareInputTestTx({ publicKey, inputCount }),
      ).toThrow('1 to 256');
    },
  );
});

function createHardwareTest() {
  const getAddress = jest.fn().mockResolvedValue({
    success: true,
    payload: { publicKey, derivedPath: `${path}/0/0` },
  });
  const sign = jest.fn().mockResolvedValue({
    success: true,
    payload: { signature: 'test-hardware-signature' },
  });
  const getAccount = jest.fn().mockResolvedValue({ pub: publicKey, path });
  const deviceParams = {
    dbDevice: {
      connectId: 'test-connect',
      deviceId: 'test-device',
      deviceType: EDeviceType.Classic1s,
    },
    deviceCommonParams: { useEmptyPassphrase: true },
  };
  const authenticate = jest.fn().mockResolvedValue({ deviceParams });
  const backgroundApi = {
    serviceAccount: { getAccount },
    servicePassword: { promptPasswordVerifyByAccount: authenticate },
    serviceHardware: {
      getSDKInstance: jest.fn().mockResolvedValue({
        alephiumGetAddress: getAddress,
        alephiumSignTransaction: sign,
      }),
    },
    serviceHardwareUI: {
      withHardwareProcessing: jest.fn(async (fn: () => Promise<void>) => fn()),
    },
  } as unknown as IBackgroundApi;
  return { backgroundApi, getAddress, sign, getAccount, authenticate };
}

describe('ALPH real hardware test runner', () => {
  it.each([16, 17, 32])(
    'sends all %i inputs to the SDK without an App hardware limit',
    async (inputCount) => {
      const { backgroundApi, sign } = createHardwareTest();
      const result = await runAlphHardwareInputTest({
        backgroundApi,
        accountId,
        inputCount,
      });
      expect(result).toMatchObject({
        success: true,
        stage: 'signTransaction',
        inputCount,
      });
      expect(sign).toHaveBeenCalledTimes(1);
      const [connectId, deviceId, params] = sign.mock.calls[0] as [
        string,
        string,
        { rawTx: string; path: string; useEmptyPassphrase: boolean },
      ];
      expect(connectId).toBe('test-connect');
      expect(deviceId).toBe('test-device');
      expect(params.path).toBe(`${path}/0/0`);
      expect(params.useEmptyPassphrase).toBe(true);
      expect(
        codec.unsignedTxCodec.decode(Buffer.from(params.rawTx, 'hex')).inputs,
      ).toHaveLength(inputCount);
      expect(result).not.toHaveProperty('signature');
    },
  );

  it('retains the real SDK error before applying the existing App mapping', async () => {
    const { backgroundApi, sign } = createHardwareTest();
    const payload = {
      code: HardwareErrorCode.TooManyInputs,
      error: 'Too many inputs',
      params: { count: 'max 16 supported' },
    };
    sign.mockResolvedValueOnce({ success: false, payload });
    const result = await runAlphHardwareInputTest({
      backgroundApi,
      accountId,
      inputCount: 17,
    });
    expect(result).toMatchObject({
      success: false,
      stage: 'signTransaction',
      sdkError: payload,
      appError: {
        code: HardwareErrorCode.TooManyInputs,
        key: 'global.too_many_inputs_notification_banner',
      },
    });
  });

  it('distinguishes address failures from a signing/input-count rejection', async () => {
    const { backgroundApi, getAddress, sign } = createHardwareTest();
    const payload = {
      code: HardwareErrorCode.PinInvalid,
      error: 'Invalid PIN',
    };
    getAddress.mockResolvedValueOnce({ success: false, payload });
    const result = await runAlphHardwareInputTest({
      backgroundApi,
      accountId,
      inputCount: 17,
    });
    expect(result).toMatchObject({
      success: false,
      stage: 'getAddress',
      sdkError: payload,
    });
    expect(sign).not.toHaveBeenCalled();
  });

  it('rejects a different hardware account before sending the transaction', async () => {
    const { backgroundApi, getAddress, sign } = createHardwareTest();
    getAddress.mockResolvedValueOnce({
      success: true,
      payload: { publicKey: `03${publicKey.slice(2)}` },
    });
    const result = await runAlphHardwareInputTest({
      backgroundApi,
      accountId,
      inputCount: 17,
    });
    expect(result).toMatchObject({
      success: false,
      appError: { message: expect.stringContaining('does not match') },
    });
    expect(sign).not.toHaveBeenCalled();
  });

  it('requires an ALPH hardware account before any authentication or device call', async () => {
    const { backgroundApi, getAccount, authenticate, sign } =
      createHardwareTest();
    const result = await runAlphHardwareInputTest({
      backgroundApi,
      accountId: 'hd-1--account',
      inputCount: 17,
    });
    expect(result).toMatchObject({ success: false, stage: 'prepare' });
    expect(getAccount).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
  });
});
