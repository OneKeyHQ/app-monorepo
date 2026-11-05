import {
  DUST_AMOUNT,
  addressFromPublicKey,
  addressToBytes,
  codec,
} from '@alephium/web3';
import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  EAlphTxType,
  type IEncodedTxAlph,
} from '@onekeyhq/core/src/chains/alph/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { ISignTransactionParams } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { convertDeviceError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { KeyringHardware } from '../KeyringHardware';

import { getAlphHardwareInputLimitError } from './hardwareInputLimit';
import * as alphUtils from './utils';

import type { SignTransferTxParams, node } from '@alephium/web3';

jest.mock('../../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./utils', () => ({
  ...jest.requireActual<typeof import('./utils')>('./utils'),
  serializeUnsignedTransaction: jest.fn(),
  deserializeUnsignedTransaction: jest.fn(),
}));

// Public secp256k1 generator point, not a user's account.
const PUBLIC_KEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SENDER = addressFromPublicKey(PUBLIC_KEY);
const RECIPIENT = '1GfF6iDLELKXUGPEZTeSqU2KD2EuZa42eiX9gTrhrRvs9';
const TOKEN_ID = '11'.repeat(32);
const GAS_PRICE = 100_000_000_000n;

type IProxyCall = {
  networkId: string;
  body: {
    route: string;
    params: { path: string; method: string; params: unknown[] };
  }[];
};

function setup(count = 17, limit = 16, gasAmount = 100_000) {
  const utxos: node.UTXO[] = Array.from({ length: count }, (_, index) => ({
    ref: { hint: 1, key: (index + 1).toString(16).padStart(64, '0') },
    amount: '10000000000000000',
  }));
  const params: SignTransferTxParams = {
    signerAddress: SENDER,
    destinations: [
      {
        address: RECIPIENT,
        attoAlphAmount: (
          BigInt(count) * 10_000_000_000_000_000n -
          BigInt(gasAmount) * GAS_PRICE -
          DUST_AMOUNT
        ).toString(),
      },
    ],
  };
  const encodedTx: IEncodedTxAlph = { type: EAlphTxType.Transfer, params };
  const payload = {
    code: HardwareErrorCode.TooManyInputs,
    error: 'Too many inputs',
    params: { count: `max ${limit} supported` as unknown },
  };
  const error = convertDeviceError(payload);
  const makeRaw = (inputs: node.UTXO[]) => {
    const destination = params.destinations[0];
    const amount = BigInt(destination.attoAlphAmount.toString());
    const total = inputs.reduce((sum, utxo) => sum + BigInt(utxo.amount), 0n);
    return Buffer.from(
      codec.unsignedTxCodec.encode({
        version: 0,
        networkId: 0,
        statefulScript: { kind: 'None', value: undefined },
        gasAmount,
        gasPrice: GAS_PRICE,
        inputs: inputs.map((utxo) => ({
          hint: utxo.ref.hint,
          key: Buffer.from(utxo.ref.key, 'hex'),
          unlockScript: {
            kind: 'P2PKH',
            value: Buffer.from(PUBLIC_KEY, 'hex'),
          },
        })),
        fixedOutputs: [
          {
            amount,
            lockupScript: {
              kind: 'P2PKH',
              value: addressToBytes(RECIPIENT).slice(1),
            },
            lockTime: 0n,
            tokens: (destination.tokens ?? []).map((token) => ({
              tokenId: Buffer.from(token.id, 'hex'),
              amount: BigInt(token.amount.toString()),
            })),
            additionalData: new Uint8Array(),
          },
          {
            amount: total - amount - BigInt(gasAmount) * GAS_PRICE,
            lockupScript: {
              kind: 'P2PKH',
              value: addressToBytes(SENDER).slice(1),
            },
            lockTime: 0n,
            tokens: [],
            additionalData: new Uint8Array(),
          },
        ],
      }),
    ).toString('hex');
  };
  const sendProxyRequest = jest.fn(async ({ body }: IProxyCall) => {
    const request = body[0].params;
    if (
      request.path === 'addresses' &&
      request.method === 'getAddressesAddressUtxos'
    )
      return [{ utxos }];
    throw new OneKeyLocalError('Unexpected ALPH proxy request');
  });
  const getNetwork = jest
    .fn()
    .mockResolvedValue({ symbol: 'ALPH', decimals: 18 });
  const getToken = jest.fn().mockResolvedValue({ symbol: 'TEST', decimals: 6 });
  const backgroundApi = {
    serviceAccountProfile: { sendProxyRequest },
    serviceNetwork: { getNetwork },
    serviceToken: { getToken },
  } as unknown as IBackgroundApi;
  const run = () =>
    getAlphHardwareInputLimitError({
      error,
      unsignedTx: makeRaw(utxos),
      encodedTx,
      backgroundApi,
      networkId: 'alph--0',
      accountId: 'hw-test',
    });
  return {
    utxos,
    params,
    encodedTx,
    payload,
    error,
    makeRaw,
    sendProxyRequest,
    getNetwork,
    getToken,
    backgroundApi,
    run,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(appLocale.intl, 'formatMessage')
    .mockImplementation(
      (_descriptor, values) =>
        `Reduce to ${String(values?.amount)} ${String(values?.symbol)}`,
    );
  jest
    .spyOn(defaultLogger.app.error, 'log')
    .mockImplementation((errorMessage) => ({ errorMessage, stacktrace: '' }));
});
afterEach(() => jest.restoreAllMocks());

describe('ALPH amount advice after a hardware rejection', () => {
  it('calculates local advice from current UTXOs, original fees and change without rebuilding', async () => {
    const ctx = setup();
    const result = await ctx.run();
    expect(result).toMatchObject({
      code: 827,
      key: ETranslations.feedback_kaspa_utxo_limit_exceeded_text,
      message: 'Reduce to 0.149 ALPH',
      info: { amount: '0.149', symbol: 'ALPH' },
      payload: ctx.error.payload,
    });
    expect(ctx.sendProxyRequest.mock.calls[0][0]).toEqual({
      networkId: 'alph--0',
      body: [
        {
          route: 'rpc',
          params: {
            path: 'addresses',
            method: 'getAddressesAddressUtxos',
            params: [SENDER],
          },
        },
      ],
    });
    expect(ctx.sendProxyRequest).toHaveBeenCalledTimes(1);
    expect(ctx.params.destinations[0].attoAlphAmount).toBe(
      '159000000000000000',
    );
    expect(ctx.params.gasAmount).toBeUndefined();
  });

  it('uses a future capacity returned by firmware, with no device-type cap', async () => {
    const ctx = setup(33, 32);
    expect(await ctx.run()).toMatchObject({
      code: 827,
      message: 'Reduce to 0.309 ALPH',
    });
    expect(ctx.sendProxyRequest).toHaveBeenCalledTimes(1);
  });

  it('follows the actual selection order rather than summing the largest UTXOs', async () => {
    const ctx = setup();
    ctx.utxos[16].amount = '1000000000000000000000';
    expect(await ctx.run()).toMatchObject({ message: 'Reduce to 0.149 ALPH' });
  });

  it('keeps exact amounts beyond Number.MAX_SAFE_INTEGER', async () => {
    const ctx = setup();
    ctx.utxos.forEach((utxo) => {
      utxo.amount = '100000000000000001';
    });
    ctx.params.destinations[0].attoAlphAmount = '1689000000000000017';
    expect(await ctx.run()).toMatchObject({
      message: 'Reduce to 1.589000000000000016 ALPH',
    });
  });

  it('uses the final unsigned transaction fee', async () => {
    const ctx = setup(17, 16, 70_000);
    expect(await ctx.run()).toMatchObject({ message: 'Reduce to 0.152 ALPH' });
  });

  it('reports token units using token metadata', async () => {
    const ctx = setup();
    ctx.utxos.forEach((utxo) => {
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    ctx.params.destinations[0].attoAlphAmount = DUST_AMOUNT.toString();
    ctx.params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '17000000' }];
    expect(await ctx.run()).toMatchObject({ message: 'Reduce to 16 TEST' });
    expect(ctx.getToken).toHaveBeenCalledTimes(1);
  });

  it('keeps the hardware rejection when token metadata is missing', async () => {
    const ctx = setup();
    ctx.utxos.forEach((utxo) => {
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    ctx.params.destinations[0].attoAlphAmount = DUST_AMOUNT.toString();
    ctx.params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '17000000' }];
    ctx.getToken.mockResolvedValue(undefined);
    expect(await ctx.run()).toBe(ctx.error);
  });

  it('reserves an input for native fees when suggesting a token amount', async () => {
    const ctx = setup(17, 16, 200_000);
    ctx.utxos.slice(0, 16).forEach((utxo) => {
      utxo.amount = DUST_AMOUNT.toString();
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    ctx.utxos[16].amount = '1000000000000000000';
    ctx.params.destinations[0].attoAlphAmount = DUST_AMOUNT.toString();
    ctx.params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '16000000' }];
    expect(await ctx.run()).toMatchObject({ message: 'Reduce to 15 TEST' });
    expect(ctx.sendProxyRequest).toHaveBeenCalledTimes(1);
    expect(ctx.params.destinations[0].tokens?.[0].amount).toBe('16000000');
  });

  it('does not suggest a zero or dust native amount', async () => {
    const ctx = setup();
    ctx.utxos.slice(0, 16).forEach((utxo) => {
      utxo.amount = '1';
    });
    ctx.utxos[16].amount = '1000000000000000000';
    expect(await ctx.run()).toBe(ctx.error);
    expect(ctx.getNetwork).not.toHaveBeenCalled();
  });

  it.each([
    '16',
    16,
    'max 0 supported',
    'max unknown supported',
    'max 9007199254740992 supported',
    undefined,
  ])('keeps the hardware error for an unrecognized limit %s', async (value) => {
    const ctx = setup();
    ctx.payload.params.count = value;
    expect(await ctx.run()).toBe(ctx.error);
    expect(ctx.sendProxyRequest).not.toHaveBeenCalled();
  });

  it.each([
    'explicitInputs',
    'multipleDestinations',
    'multipleTokens',
    'nativeAndToken',
    'unsignedTx',
  ])('does not invent one amount for %s', async (scenario) => {
    const ctx = setup();
    if (scenario === 'explicitInputs')
      ctx.params.utxos = ctx.utxos.map((utxo) => utxo.ref);
    if (scenario === 'multipleDestinations')
      ctx.params.destinations.push({ ...ctx.params.destinations[0] });
    if (scenario === 'multipleTokens')
      ctx.params.destinations[0].tokens = [
        { id: TOKEN_ID, amount: '1' },
        { id: '22'.repeat(32), amount: '1' },
      ];
    if (scenario === 'nativeAndToken')
      ctx.params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '1' }];
    if (scenario === 'unsignedTx') ctx.encodedTx.type = EAlphTxType.UnsignedTx;
    expect(await ctx.run()).toBe(ctx.error);
    expect(ctx.sendProxyRequest).not.toHaveBeenCalled();
  });

  it('retains the hardware failure when a selected UTXO disappeared', async () => {
    const ctx = setup();
    ctx.sendProxyRequest.mockResolvedValueOnce([{ utxos: ctx.utxos.slice(1) }]);
    expect(await ctx.run()).toBe(ctx.error);
    expect(ctx.getNetwork).not.toHaveBeenCalled();
  });

  it('keeps the original SDK payload when advisory RPC fails', async () => {
    const ctx = setup();
    const errorLog = jest.spyOn(defaultLogger.app.error, 'log');
    ctx.sendProxyRequest.mockRejectedValue(new Error('RPC unavailable'));
    expect(await ctx.run()).toBe(ctx.error);
    expect(ctx.sendProxyRequest).toHaveBeenCalledTimes(1);
    expect(ctx.error.payload?.code).toBe(827);
    expect(errorLog).toHaveBeenCalledWith(
      'Failed to calculate ALPH input-limit amount suggestion',
    );
  });
});

function hardwareSetup(count = 17) {
  const ctx = setup(count);
  const rawTx = ctx.makeRaw(ctx.utxos);
  jest.mocked(alphUtils.serializeUnsignedTransaction).mockResolvedValue({
    unsignedTx: rawTx,
    txId: '00'.repeat(32),
    fromGroup: 0,
    toGroup: 0,
    gasAmount: 100_000,
    gasPrice: GAS_PRICE,
  });
  jest.mocked(alphUtils.deserializeUnsignedTransaction).mockResolvedValue({
    fromGroup: 0,
    toGroup: 0,
    unsignedTx: codec.unsignedTxCodec.decodeApiUnsignedTx(
      Buffer.from(rawTx, 'hex'),
    ),
  });
  const sdkSign = jest
    .fn()
    .mockResolvedValue({ success: false, payload: ctx.payload });
  const keyring = Object.create(KeyringHardware.prototype) as KeyringHardware;
  Object.assign(keyring, {
    vault: {
      accountId: 'hw-test',
      networkId: 'alph--0',
      backgroundApi: ctx.backgroundApi,
      getAccount: jest.fn().mockResolvedValue({
        id: 'hw-test',
        pub: PUBLIC_KEY,
        path: "m/44'/1234'/0'",
      }),
    },
    getHardwareSDKInstance: jest.fn().mockResolvedValue({
      alephiumGetAddress: jest.fn().mockResolvedValue({
        success: true,
        payload: { derivedPath: "m/44'/1234'/0'/0/0" },
      }),
      alephiumSignTransaction: sdkSign,
    }),
  });
  const sign = () =>
    keyring.signTransaction({
      unsignedTx: { encodedTx: ctx.encodedTx },
      deviceParams: {
        dbDevice: { connectId: 'test-connect', deviceId: 'test-device' },
        deviceCommonParams: {},
      },
    } as ISignTransactionParams);
  return { ...ctx, sdkSign, sign };
}

describe('ALPH hardware signing error integration', () => {
  it('attempts signing before calculating a reference amount, without signing again', async () => {
    const ctx = hardwareSetup();
    await expect(ctx.sign()).rejects.toMatchObject({
      code: 827,
      message: 'Reduce to 0.149 ALPH',
    });
    expect(ctx.sdkSign).toHaveBeenCalledTimes(1);
    expect(ctx.sdkSign.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.sendProxyRequest.mock.invocationCallOrder[0],
    );
  });

  it('preserves a real generic Pro firmware error without amount advice', async () => {
    const ctx = hardwareSetup(32);
    ctx.sdkSign.mockResolvedValueOnce({
      success: false,
      payload: { code: 800, error: 'Failure_FirmwareError,Firmware error' },
    });
    await expect(ctx.sign()).rejects.toMatchObject({ payload: { code: 800 } });
    expect(ctx.sendProxyRequest).not.toHaveBeenCalled();
  });

  it('accepts hardware-supported transactions over 16 inputs without advisory RPC', async () => {
    const ctx = hardwareSetup(32);
    ctx.sdkSign.mockResolvedValueOnce({
      success: true,
      payload: { signature: 'public-test-signature' },
    });
    await expect(ctx.sign()).resolves.toMatchObject({
      signature: 'public-test-signature',
    });
    expect(ctx.sendProxyRequest).not.toHaveBeenCalled();
  });

  it('keeps the real hardware error if the advisory module unexpectedly rejects', async () => {
    const ctx = hardwareSetup();
    Object.defineProperty(ctx.encodedTx, 'params', {
      get: () => {
        throw new OneKeyLocalError('Advisory lookup unavailable');
      },
    });
    await expect(ctx.sign()).rejects.toMatchObject({
      code: 827,
      payload: expect.objectContaining(ctx.payload),
    });
    expect(ctx.sdkSign).toHaveBeenCalledTimes(1);
    expect(ctx.sendProxyRequest).not.toHaveBeenCalled();
  });
});
