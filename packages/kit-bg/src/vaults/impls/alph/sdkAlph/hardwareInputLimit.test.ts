import { TransactionBuilder, addressFromTokenId, codec } from '@alephium/web3';
import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  EAlphTxType,
  type IEncodedTxAlph,
} from '@onekeyhq/core/src/chains/alph/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { TooManyTransactionInputs } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { checkAlphHardwareInputLimit } from './hardwareInputLimit';

import type { SignTransferTxParams, node } from '@alephium/web3';

const FROM = 'test-signer';
const TOKEN_ID = '11'.repeat(32);
const PUBLIC_KEY = Buffer.from(
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  'hex',
);

function setup(count = 17, gasAmount = 20_000) {
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
      { address: 'test-recipient', attoAlphAmount: '168000000000000000' },
    ],
  };
  const encodedTx: IEncodedTxAlph = { type: EAlphTxType.Transfer, params };
  const rawTx = (inputUtxos = utxos) =>
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
        fixedOutputs: [
          {
            amount: 1_000_000_000_000_000n,
            lockupScript: { kind: 'P2PKH', value: Buffer.alloc(32, 0x22) },
            lockTime: 0n,
            tokens: [],
            additionalData: new Uint8Array(),
          },
        ],
      }),
    ).toString('hex');
  const builtResult = (inputUtxos = utxos.slice(0, 16)) => ({
    unsignedTx: rawTx(inputUtxos),
    fromGroup: 0,
    toGroup: 0,
    txId: 'fixture',
    gasAmount,
    gasPrice: 100_000_000_000n,
  });
  const buildTransferTx = jest
    .spyOn(TransactionBuilder.prototype, 'buildTransferTx')
    .mockImplementation(async () => builtResult());
  const check = (deviceType: EDeviceType = EDeviceType.Classic1s) =>
    checkAlphHardwareInputLimit({
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
      const { check, sendProxyRequest } = setup(16);
      await expect(check(deviceType)).resolves.toBeUndefined();
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
    const { check, sendProxyRequest, getNetwork } = setup(32);
    await expect(check(deviceType)).resolves.toBeUndefined();
    expect(sendProxyRequest).not.toHaveBeenCalled();
    expect(getNetwork).not.toHaveBeenCalled();
  });

  it.each([EDeviceType.Classic1s, EDeviceType.ClassicPure])(
    'reports the ALPH amount after the actual fee and change reserve on %s',
    async (deviceType) => {
      const { check, sendProxyRequest, getToken } = setup();
      await expect(check(deviceType)).rejects.toThrow('0.157 ALPH');
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

  it('uses the actual selection order instead of advertising the largest 16 UTXOs', async () => {
    const { check, utxos } = setup();
    utxos[16].amount = '1000000000000000000000';
    await expect(check()).rejects.toThrow('0.157 ALPH');
  });

  it('preserves small fractions and values beyond Number.MAX_SAFE_INTEGER', async () => {
    const { check, utxos, params } = setup();
    utxos.forEach((utxo) => {
      utxo.amount = '100000000000000001';
    });
    params.destinations[0].attoAlphAmount = '1698000000000000017';
    await expect(check()).rejects.toThrow('1.597000000000000016 ALPH');
  });

  it('uses the fee in the final unsigned bytes when the gas amount changes', async () => {
    const { check } = setup(17, 70_000);
    await expect(check()).rejects.toThrow('0.152 ALPH');
  });

  it('does not advertise zero when the first 16 inputs cannot cover the fee', async () => {
    const { check, utxos, buildTransferTx } = setup();
    utxos.slice(0, 16).forEach((utxo) => {
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

  it('does not fabricate an amount after an input disappears from the UTXO response', async () => {
    const { check, sendProxyRequest, utxos, getNetwork } = setup();
    sendProxyRequest.mockResolvedValue([{ utxos: utxos.slice(1) }]);
    await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
    expect(getNetwork).not.toHaveBeenCalled();
  });

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
    const { check, params, buildTransferTx } = setup();
    const requested = params.destinations[0].attoAlphAmount;
    await expect(check()).rejects.toThrow('0.157 ALPH');
    expect(buildTransferTx).toHaveBeenCalledWith(
      {
        ...params,
        gasAmount: 20_000,
        gasPrice: 100_000_000_000n,
        destinations: [
          {
            ...params.destinations[0],
            attoAlphAmount: 157_000_000_000_000_000n,
          },
        ],
      },
      PUBLIC_KEY.toString('hex'),
    );
    expect(params.destinations[0].attoAlphAmount).toBe(requested);
    expect(params.gasAmount).toBeUndefined();
    expect(params.gasPrice).toBeUndefined();
  });

  it('lowers the hint again when the node still builds too many inputs', async () => {
    const { check, buildTransferTx, builtResult, utxos } = setup();
    buildTransferTx.mockResolvedValueOnce(builtResult(utxos));
    await expect(check()).rejects.toThrow('0.147 ALPH');
    expect(buildTransferTx).toHaveBeenCalledTimes(2);
  });

  it('does not give a false token hint when lowering the amount still consumes every small input', async () => {
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
    expect(buildTransferTx.mock.calls.length).toBeLessThanOrEqual(16);
    expect(getToken).not.toHaveBeenCalled();
  });

  it('does not suggest a token amount that is greater than the original request', async () => {
    const { check, params, utxos, buildTransferTx } = setup();
    utxos.forEach((utxo) => {
      utxo.tokens = [{ id: TOKEN_ID, amount: '1000000' }];
    });
    params.destinations[0].attoAlphAmount = '1000000000000000';
    params.destinations[0].tokens = [{ id: TOKEN_ID, amount: '1' }];
    await expect(check()).rejects.toBeInstanceOf(TooManyTransactionInputs);
    expect(buildTransferTx).not.toHaveBeenCalled();
  });

  it('preserves a node failure instead of claiming an unverified amount', async () => {
    const { check, buildTransferTx } = setup();
    buildTransferTx.mockRejectedValue(new Error('RPC unavailable'));
    await expect(check()).rejects.toThrow('RPC unavailable');
  });
});
