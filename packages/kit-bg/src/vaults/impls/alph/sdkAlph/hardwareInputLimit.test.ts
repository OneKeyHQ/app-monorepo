import { TransactionBuilder, addressFromTokenId, codec } from '@alephium/web3';
import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  EAlphTxType,
  type IEncodedTxAlph,
} from '@onekeyhq/core/src/chains/alph/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import {
  OneKeyLocalError,
  TooManyTransactionInputs,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { prepareAlphHardwareTransaction } from './hardwareInputLimit';

import type { SignTransferTxParams, node } from '@alephium/web3';

const FROM = 'test-signer';
const TOKEN_ID = '11'.repeat(32);
const PUBLIC_KEY = Buffer.from(
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  'hex',
);

function setup(count = 17, gasAmount = 70_000, originalOutputCount = 1) {
  const utxos: node.UTXO[] = Array.from({ length: count }, (_, index) => ({
    ref: { hint: 1, key: (index + 1).toString(16).padStart(64, '0') },
    amount: '10000000000000000',
  }));
  const getToken = jest.fn().mockResolvedValue({ symbol: 'TEST', decimals: 6 });
  const getNetwork = jest
    .fn()
    .mockResolvedValue({ symbol: 'ALPH', decimals: 18 });
  const sendProxyRequest = jest
    .fn()
    .mockImplementation(async () => [{ utxos }]);
  const backgroundApi = {
    serviceNetwork: { getNetwork },
    serviceToken: { getToken },
    serviceAccountProfile: { sendProxyRequest },
  } as unknown as IBackgroundApi;
  const params: SignTransferTxParams = {
    signerAddress: FROM,
    destinations: [
      { address: 'test-recipient', attoAlphAmount: '163000000000000000' },
    ],
  };
  const encodedTx: IEncodedTxAlph = { type: EAlphTxType.Transfer, params };
  const rawTx = (
    inputUtxos = utxos.slice(0, count),
    outputCount = originalOutputCount,
  ) =>
    Buffer.from(
      codec.unsignedTxCodec.encode({
        version: 0,
        networkId: 0,
        statefulScript: { kind: 'None', value: undefined },
        gasAmount,
        gasPrice: 100_000_000_000n,
        inputs: inputUtxos.map((utxo, index) => ({
          hint: utxo.ref.hint,
          key: Buffer.from(utxo.ref.key, 'hex'),
          unlockScript:
            index === 0
              ? { kind: 'P2PKH', value: PUBLIC_KEY }
              : { kind: 'SameAsPrevious', value: 'SameAsPrevious' },
        })),
        fixedOutputs: Array.from({ length: outputCount }, () => ({
          amount: 1_000_000_000_000_000n,
          lockupScript: {
            kind: 'P2PKH' as const,
            value: Buffer.alloc(32, 0x22),
          },
          lockTime: 0n,
          tokens: [],
          additionalData: new Uint8Array(),
        })),
      }),
    ).toString('hex');
  const builtResult = (
    inputUtxos = utxos.slice(0, 16),
    outputCount = originalOutputCount,
  ) => ({
    unsignedTx: rawTx(inputUtxos, outputCount),
    fromGroup: 0,
    toGroup: 0,
    txId: 'fixture',
    gasAmount,
    gasPrice: 100_000_000_000n,
  });
  const buildTransferTx = jest
    .spyOn(TransactionBuilder.prototype, 'buildTransferTx')
    .mockImplementation(async (retryParams) => {
      const selected = retryParams.utxos?.map((ref) => {
        const input = utxos.find(
          (utxo) => utxo.ref.key === ref.key && utxo.ref.hint === ref.hint,
        );
        if (!input) throw new OneKeyLocalError('UTXO already spent');
        return input;
      });
      return builtResult(selected);
    });
  const check = (deviceType: EDeviceType = EDeviceType.Classic1s) =>
    prepareAlphHardwareTransaction({
      unsignedTx: rawTx(),
      encodedTx,
      backgroundApi,
      networkId: 'alph--mainnet',
      accountId: 'hw-test',
      deviceType,
      publicKey: PUBLIC_KEY.toString('hex'),
    });
  return {
    check,
    rawTx,
    params,
    encodedTx,
    utxos,
    getToken,
    getNetwork,
    sendProxyRequest,
    backgroundApi,
    buildTransferTx,
    builtResult,
  };
}

beforeEach(() => {
  jest
    .spyOn(appLocale.intl, 'formatMessage')
    .mockImplementation((descriptor, values) =>
      descriptor.id === ETranslations.feedback_kaspa_utxo_limit_exceeded_text
        ? `Reduce transfer amount to ${String(values?.amount)} ${String(values?.symbol)}`
        : 'Too many transaction inputs',
    );
});
afterEach(() => jest.restoreAllMocks());

describe('Alephium hardware input limits', () => {
  it.each([EDeviceType.Classic1s, EDeviceType.ClassicPure])(
    'allows exactly 16 inputs on %s without fetching UTXO amounts',
    async (deviceType) => {
      const { check, sendProxyRequest, rawTx, encodedTx } = setup(16);
      await expect(check(deviceType)).resolves.toEqual({
        unsignedTx: rawTx(),
        encodedTx,
      });
      expect(sendProxyRequest).not.toHaveBeenCalled();
    },
  );

  it.each([
    EDeviceType.Pro,
    EDeviceType.Pro2,
    EDeviceType.Neo,
    EDeviceType.Touch,
    EDeviceType.Classic,
    EDeviceType.Mini,
    EDeviceType.Unknown,
  ])('does not introduce a 16-input cap on %s', async (deviceType) => {
    const { check, sendProxyRequest, getNetwork, rawTx, encodedTx } = setup(32);
    await expect(check(deviceType)).resolves.toEqual({
      unsignedTx: rawTx(),
      encodedTx,
    });
    expect(sendProxyRequest).not.toHaveBeenCalled();
    expect(getNetwork).not.toHaveBeenCalled();
  });

  it.each([EDeviceType.Classic1s, EDeviceType.ClassicPure])(
    'reports the ALPH amount after the actual fee and change reserve on %s',
    async (deviceType) => {
      const { check, sendProxyRequest, getToken } = setup();
      await expect(check(deviceType)).rejects.toThrow('0.152 ALPH');
      expect(sendProxyRequest).toHaveBeenCalledWith({
        networkId: 'alph--mainnet',
        body: [
          {
            route: 'rpc',
            params: {
              path: 'addresses',
              method: 'getAddressesAddressUtxos',
              params: [FROM],
            },
          },
        ],
      });
      expect(getToken).not.toHaveBeenCalled();
    },
  );

  it('retries the original amount using a large UTXO outside the original input set', async () => {
    const { check, utxos, params, buildTransferTx, getNetwork } = setup();
    const large = {
      ref: { hint: 1, key: 'ff'.repeat(32) },
      amount: '1000000000000000000',
    };
    utxos.push(large);
    const result = await check();
    expect(result.encodedTx.params).toEqual({
      ...params,
      utxos: [large.ref],
      gasAmount: 70_000,
      gasPrice: '100000000000',
    });
    expect(params.utxos).toBeUndefined();
    expect(buildTransferTx).toHaveBeenCalledTimes(1);
    expect(getNetwork).not.toHaveBeenCalled();
  });

  it('uses the largest available inputs for the amount hint', async () => {
    const { check, utxos, params, buildTransferTx } = setup();
    utxos[16].amount = '20000000000000000';
    params.destinations[0].attoAlphAmount = '173000000000000000';
    await expect(check()).rejects.toThrow('0.162 ALPH');
    expect(buildTransferTx.mock.calls[0][0].utxos?.[0]).toEqual(utxos[16].ref);
    expect(buildTransferTx).toHaveBeenCalledTimes(1);
  });

  it.each(['locked', 'foreignToken', 'duplicate'])(
    'does not count %s UTXOs toward the amount hint',
    async (scenario) => {
      const { check, utxos } = setup();
      const large: node.UTXO = {
        ref: { hint: 1, key: 'ff'.repeat(32) },
        amount: '1000000000000000000',
      };
      if (scenario === 'locked') large.lockTime = Date.now() + 60_000;
      if (scenario === 'foreignToken')
        large.tokens = [{ id: '22'.repeat(32), amount: '1' }];
      utxos.push(scenario === 'duplicate' ? { ...utxos[0] } : large);
      await expect(check()).rejects.toThrow('0.152 ALPH');
    },
  );

  it('preserves small fractions and values beyond Number.MAX_SAFE_INTEGER', async () => {
    const { check, utxos, params } = setup();
    utxos.forEach((utxo) => {
      utxo.amount = '100000000000000001';
    });
    params.destinations[0].attoAlphAmount = '1693000000000000017';
    await expect(check()).rejects.toThrow('1.592000000000000016 ALPH');
  });

  it('uses the fee in the final unsigned bytes when the gas amount changes', async () => {
    const { check } = setup(17, 100_000);
    await expect(check()).rejects.toThrow('0.149 ALPH');
  });

  it('does not advertise zero when the largest 16 inputs cannot cover the fee', async () => {
    const { check, utxos, buildTransferTx } = setup();
    utxos.forEach((utxo) => {
      utxo.amount = '1';
    });
    await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
    expect(buildTransferTx).not.toHaveBeenCalled();
  });

  it('reports the transferred token units instead of native ALPH units', async () => {
    const { check, utxos, params, getToken } = setup();
    utxos.forEach((utxo) => {
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    params.destinations[0].attoAlphAmount = '1000000000000000';
    params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '17000000' }];
    await expect(check()).rejects.toThrow('16 TEST');
    expect(getToken).toHaveBeenCalledWith({
      accountId: 'hw-test',
      networkId: 'alph--mainnet',
      tokenIdOnNetwork: addressFromTokenId(TOKEN_ID),
    });
  });

  it('reserves an input for native fees when reducing a token transfer', async () => {
    const { check, utxos, params } = setup(17, 200_000);
    utxos.slice(0, 16).forEach((utxo) => {
      utxo.amount = '1000000000000000';
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    utxos[16].amount = '1000000000000000000';
    params.destinations[0].attoAlphAmount = '1000000000000000';
    params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '17000000' }];
    await expect(check()).rejects.toThrow('15 TEST');
  });

  it('accounts for several native fee inputs within the same 16-input budget', async () => {
    const { check, utxos, params } = setup(19, 240_000);
    utxos.slice(0, 16).forEach((utxo) => {
      utxo.amount = '1000000000000000';
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    utxos.slice(16).forEach((utxo) => {
      utxo.amount = '5000000000000000';
    });
    params.destinations[0].attoAlphAmount = '1000000000000000';
    params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '16000000' }];
    await expect(check()).rejects.toThrow('13 TEST');
  });

  it.each([
    'explicitInputs',
    'multipleDestinations',
    'multipleTokens',
    'nativeAndToken',
    'unsignedTx',
  ])(
    'keeps the input-count error when a single amount cannot describe %s',
    async (scenario) => {
      const { check, params, encodedTx, utxos, sendProxyRequest } = setup();
      if (scenario === 'explicitInputs')
        params.utxos = utxos.map((utxo) => utxo.ref);
      if (scenario === 'multipleDestinations')
        params.destinations.push({ ...params.destinations[0] });
      if (scenario === 'multipleTokens')
        params.destinations[0].tokens = [
          { id: TOKEN_ID, amount: '1' },
          { id: '22'.repeat(32), amount: '1' },
        ];
      if (scenario === 'unsignedTx') encodedTx.type = EAlphTxType.UnsignedTx;
      if (scenario === 'nativeAndToken')
        params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '1' }];
      await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
      expect(sendProxyRequest).not.toHaveBeenCalled();
    },
  );

  it('does not label unknown token quantities using native decimals', async () => {
    const { check, utxos, params, getToken } = setup();
    utxos.forEach((utxo) => {
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    params.destinations[0].attoAlphAmount = '1000000000000000';
    params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '17000000' }];
    getToken.mockResolvedValue(null);
    await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
    expect(getToken).toHaveBeenCalled();
  });

  it('verifies the suggested amount using copied parameters and the final fee', async () => {
    const { check, params, buildTransferTx, utxos } = setup();
    const requested = params.destinations[0].attoAlphAmount;
    await expect(check()).rejects.toThrow('0.152 ALPH');
    expect(buildTransferTx).toHaveBeenCalledWith(
      {
        ...params,
        utxos: utxos.slice(0, 16).map((utxo) => utxo.ref),
        gasAmount: 70_000,
        gasPrice: '100000000000',
        destinations: [
          {
            ...params.destinations[0],
            attoAlphAmount: '152000000000000000',
          },
        ],
      },
      PUBLIC_KEY.toString('hex'),
    );
    expect(params.destinations[0].attoAlphAmount).toBe(requested);
    expect(params.gasAmount).toBeUndefined();
    expect(params.gasPrice).toBeUndefined();
  });

  it('falls back after one retry if the node still builds too many inputs', async () => {
    const { check, buildTransferTx, builtResult, utxos } = setup();
    buildTransferTx.mockResolvedValueOnce(builtResult(utxos));
    await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
    expect(buildTransferTx).toHaveBeenCalledTimes(1);
  });

  it('does not pull foreign tokens into the fee inputs', async () => {
    const { check, params, utxos, buildTransferTx, builtResult, getToken } =
      setup(18, 200_000);
    utxos.slice(0, 17).forEach((utxo) => {
      utxo.amount = '1000000000000000';
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    utxos[17].amount = '1000000000000000000';
    utxos[17].tokens = [{ id: '22'.repeat(32), amount: '1' }];
    params.destinations[0].attoAlphAmount = '1000000000000000';
    params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '17000000' }];
    buildTransferTx.mockImplementation(async () => builtResult(utxos));
    await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
    expect(buildTransferTx).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });

  it('keeps the original token amount when a larger input can cover it', async () => {
    const { check, params, utxos, buildTransferTx } = setup();
    utxos.forEach((utxo) => {
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    params.destinations[0].attoAlphAmount = '1000000000000000';
    params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '1' }];
    const result = await check();
    expect(
      (result.encodedTx.params as SignTransferTxParams).destinations,
    ).toEqual(params.destinations);
    expect(buildTransferTx).toHaveBeenCalledTimes(1);
  });

  it.each(['fee', 'refs'])(
    'rejects a retry that changes the requested %s',
    async (scenario) => {
      const { check, buildTransferTx, builtResult, utxos } = setup();
      if (scenario === 'refs')
        buildTransferTx.mockResolvedValueOnce(builtResult(utxos.slice(1)));
      else
        buildTransferTx.mockImplementationOnce(async () => {
          const result = builtResult();
          const decoded = codec.unsignedTxCodec.decode(
            Buffer.from(result.unsignedTx, 'hex'),
          );
          decoded.gasAmount += 1;
          return {
            ...result,
            unsignedTx: Buffer.from(
              codec.unsignedTxCodec.encode(decoded),
            ).toString('hex'),
          };
        });
      await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
      expect(buildTransferTx).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a duplicate returned input even when every reference is selected', async () => {
    const { check, buildTransferTx, builtResult, utxos } = setup();
    const returned = utxos.slice(0, 16);
    returned[15] = returned[0];
    buildTransferTx.mockResolvedValueOnce(builtResult(returned));
    await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
  });

  it('does not sign a token retry whose extra change output exceeds the confirmed gas', async () => {
    const { check, params, utxos, buildTransferTx, builtResult } = setup(
      17,
      46_060,
      2,
    );
    utxos.forEach((utxo) => {
      utxo.amount = '500000000000000';
      utxo.tokens = [{ id: TOKEN_ID, amount: '100' }];
    });
    utxos.push({
      ref: { hint: 1, key: 'ff'.repeat(32) },
      amount: '1000000000000000',
      tokens: [{ id: TOKEN_ID, amount: '201' }],
    });
    params.destinations[0].attoAlphAmount = '1000000000000000';
    params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '1700' }];
    buildTransferTx.mockImplementationOnce(async (retryParams) => {
      const refs = new Set(retryParams.utxos?.map((ref) => ref.key));
      return builtResult(
        utxos.filter((utxo) => refs.has(utxo.ref.key)),
        3,
      );
    });
    await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
    expect(buildTransferTx).toHaveBeenCalledTimes(1);
    expect(buildTransferTx.mock.calls[0][0].destinations).toEqual(
      params.destinations,
    );
    expect(buildTransferTx.mock.calls[0][0].gasAmount).toBe(46_060);
  });

  it('preserves a node failure instead of claiming an unverified amount', async () => {
    const { check, buildTransferTx } = setup();
    buildTransferTx.mockRejectedValue(new OneKeyLocalError('RPC unavailable'));
    await expect(check()).rejects.toThrow('RPC unavailable');
  });
});
