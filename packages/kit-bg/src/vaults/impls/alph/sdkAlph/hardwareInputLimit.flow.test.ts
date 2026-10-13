import {
  addressFromLockupScript,
  addressFromPublicKey,
  codec,
} from '@alephium/web3';
import { EDeviceType } from '@onekeyfe/hd-shared';

import {
  EAlphTxType,
  type IEncodedTxAlph,
} from '@onekeyhq/core/src/chains/alph/types';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import type { ISignTransactionParams } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { KeyringHardware } from '../KeyringHardware';
import AlphVault from '../Vault';

import type { SignTransferTxParams, node } from '@alephium/web3';
import type { AlephiumSignTransactionParams } from '@onekeyfe/hd-core';

jest.mock('../../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/errors/utils/deviceErrorUtils', () => ({
  convertDeviceResponse: jest.fn(async (call: () => Promise<unknown>) =>
    call(),
  ),
}));

const PUBLIC_KEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const FROM = addressFromPublicKey(PUBLIC_KEY);
const RECIPIENT_SCRIPT = {
  kind: 'P2PKH' as const,
  value: Buffer.alloc(32, 0x22),
};
const TO = addressFromLockupScript(RECIPIENT_SCRIPT);
const ACCOUNT_ID = "hw-test--m/44'/1234'/0'";
const GAS_AMOUNT = 70_000;
const GAS_PRICE = 100_000_000_000n;

function setup(deviceType: EDeviceType, count = 17, hardware = true) {
  const utxos: node.UTXO[] = Array.from({ length: count }, (_, index) => ({
    ref: { hint: 1, key: (index + 1).toString(16).padStart(64, '0') },
    amount: '10000000000000000',
  }));
  const requested =
    BigInt(count) * 10_000_000_000_000_000n - BigInt(GAS_AMOUNT) * GAS_PRICE;
  const params: SignTransferTxParams = {
    signerAddress: FROM,
    destinations: [{ address: TO, attoAlphAmount: requested.toString() }],
  };
  const encodedTx: IEncodedTxAlph = { type: EAlphTxType.Transfer, params };
  const account = {
    id: hardware ? ACCOUNT_ID : "hd-test--m/44'/1234'/0'",
    address: FROM,
    path: "m/44'/1234'/0'",
    pub: PUBLIC_KEY,
  };
  const getAccountDeviceSafe = jest.fn().mockResolvedValue({ deviceType });
  const getNetwork = jest
    .fn()
    .mockResolvedValue({ decimals: 18, symbol: 'ALPH' });
  const sendProxyRequest = jest
    .fn<
      Promise<unknown[]>,
      [{ body: { params: { method: string; params: unknown[] } }[] }]
    >()
    .mockImplementation(
      async ({
        body,
      }: {
        body: { params: { method: string; params: unknown[] } }[];
      }) => {
        const request = body[0].params;
        if (request.method === 'getAddressesAddressUtxos') return [{ utxos }];
        if (request.method === 'postTransactionsDecodeUnsignedTx') {
          const data = request.params[0] as node.DecodeUnsignedTx;
          return [
            {
              unsignedTx: codec.UnsignedTxCodec.toApiUnsignedTx(
                codec.unsignedTxCodec.decode(
                  Buffer.from(data.unsignedTx, 'hex'),
                ),
              ),
            },
          ];
        }
        if (request.method !== 'postTransactionsBuild')
          throw new OneKeyLocalError('Unexpected RPC method');
        const data = request.params[0] as node.BuildTransferTx;
        const amount = BigInt(data.destinations[0].attoAlphAmount ?? '0');
        const gasAmount = data.gasAmount ?? GAS_AMOUNT;
        const gasPrice = BigInt(data.gasPrice ?? GAS_PRICE.toString());
        const required = amount + BigInt(gasAmount) * gasPrice;
        let total = 0n;
        const selected: node.UTXO[] = [];
        const pool = data.utxos
          ? data.utxos.map((ref) => {
              const utxo = utxos.find(
                (item) =>
                  item.ref.key === ref.key && item.ref.hint === ref.hint,
              );
              if (!utxo) throw new OneKeyLocalError('UTXO already spent');
              return utxo;
            })
          : utxos;
        for (const utxo of pool) {
          if (!data.utxos && total >= required) break;
          selected.push(utxo);
          total += BigInt(utxo.amount);
        }
        if (total < required) throw new OneKeyLocalError('Insufficient funds');
        const fixedOutputs: ReturnType<
          typeof codec.unsignedTxCodec.decode
        >['fixedOutputs'] = [
          {
            amount,
            lockupScript: RECIPIENT_SCRIPT,
            lockTime: 0n,
            tokens: [],
            additionalData: new Uint8Array(),
          },
        ];
        if (total > required)
          fixedOutputs.push({
            amount: total - required,
            lockupScript: { kind: 'P2PKH', value: Buffer.alloc(32, 0x33) },
            lockTime: 0n,
            tokens: [],
            additionalData: new Uint8Array(),
          });
        const unsignedTx = Buffer.from(
          codec.unsignedTxCodec.encode({
            version: 0,
            networkId: 0,
            statefulScript: { kind: 'None', value: undefined },
            gasAmount,
            gasPrice,
            inputs: selected.map((utxo, index) => ({
              hint: utxo.ref.hint,
              key: Buffer.from(utxo.ref.key, 'hex'),
              unlockScript:
                index === 0
                  ? { kind: 'P2PKH', value: Buffer.from(PUBLIC_KEY, 'hex') }
                  : { kind: 'SameAsPrevious', value: 'SameAsPrevious' },
            })),
            fixedOutputs,
          }),
        ).toString('hex');
        return [
          {
            unsignedTx,
            fromGroup: 0,
            toGroup: 0,
            txId: 'fixture',
            gasAmount,
            gasPrice: gasPrice.toString(),
          },
        ];
      },
    );
  const backgroundApi = {
    serviceAccount: { getAccountDeviceSafe },
    serviceNetwork: { getNetwork },
    serviceAccountProfile: {
      sendProxyRequest,
      fetchAccountNativeBalance: jest.fn().mockResolvedValue({ balance: '0' }),
    },
  } as unknown as IBackgroundApi;
  const vault = Object.assign(Object.create(AlphVault.prototype), {
    networkId: 'alph--mainnet',
    accountId: account.id,
    backgroundApi,
    getAccount: jest.fn().mockResolvedValue(account),
    getNetwork,
  }) as AlphVault;
  const alephiumGetAddress = jest.fn().mockResolvedValue({
    success: true,
    payload: { derivedPath: `${account.path}/0/0` },
  });
  const alephiumSignTransaction = jest
    .fn<
      Promise<{ signature: string }>,
      [string, string, AlephiumSignTransactionParams]
    >()
    .mockResolvedValue({ signature: '11'.repeat(64) });
  const keyring = Object.assign(Object.create(KeyringHardware.prototype), {
    vault,
    getHardwareSDKInstance: jest
      .fn()
      .mockResolvedValue({ alephiumGetAddress, alephiumSignTransaction }),
  }) as KeyringHardware;
  const signParams = {
    unsignedTx: { encodedTx },
    deviceParams: {
      dbDevice: { connectId: 'connection', deviceId: 'device', deviceType },
      deviceCommonParams: {},
    },
  } as ISignTransactionParams;
  return {
    vault,
    keyring,
    utxos,
    encodedTx,
    params,
    signParams,
    sendProxyRequest,
    getAccountDeviceSafe,
    alephiumGetAddress,
    alephiumSignTransaction,
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

describe('Alephium amount checks before hardware signing', () => {
  it.each([EDeviceType.Classic1s, EDeviceType.ClassicPure])(
    'reports an executable amount during fee estimation on %s',
    async (deviceType) => {
      const { vault, encodedTx, params } = setup(deviceType);
      const originalAmount = params.destinations[0].attoAlphAmount;
      await expect(vault.buildEstimateFeeParams({ encodedTx })).rejects.toThrow(
        '0.152 ALPH',
      );
      expect(params.destinations[0].attoAlphAmount).toBe(originalAmount);
    },
  );

  it.each([EDeviceType.Classic1s, EDeviceType.ClassicPure])(
    'rejects 17 inputs before address retrieval and signing on %s',
    async (deviceType) => {
      const {
        keyring,
        signParams,
        alephiumGetAddress,
        alephiumSignTransaction,
      } = setup(deviceType);
      await expect(keyring.signTransaction(signParams)).rejects.toThrow(
        '0.152 ALPH',
      );
      expect(alephiumGetAddress).not.toHaveBeenCalled();
      expect(alephiumSignTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([EDeviceType.Classic1s, EDeviceType.ClassicPure])(
    'uses a large input for fee estimation and signs the same amount on %s',
    async (deviceType) => {
      const {
        vault,
        keyring,
        encodedTx,
        signParams,
        utxos,
        params,
        alephiumSignTransaction,
        sendProxyRequest,
      } = setup(deviceType);
      const large = {
        ref: { hint: 1, key: 'ff'.repeat(32) },
        amount: '1000000000000000000',
      };
      utxos.push(large);
      const originalAmount = params.destinations[0].attoAlphAmount;
      const fee = await vault.buildEstimateFeeParams({ encodedTx });
      expect(() => JSON.stringify(fee.encodedTx)).not.toThrow();
      expect(fee.encodedTx).toMatchObject({
        utxos: [large.ref],
        gasAmount: GAS_AMOUNT,
        gasPrice: GAS_PRICE.toString(),
      });
      const signed = await keyring.signTransaction(signParams);
      const raw = alephiumSignTransaction.mock.calls[0][2].rawTx as string;
      const decoded = codec.unsignedTxCodec.decode(Buffer.from(raw, 'hex'));
      expect(decoded.inputs).toHaveLength(1);
      expect(Buffer.from(decoded.inputs[0].key).toString('hex')).toBe(
        large.ref.key,
      );
      expect(decoded.fixedOutputs[0].amount.toString()).toBe(originalAmount);
      expect(decoded.gasAmount).toBe(GAS_AMOUNT);
      expect(decoded.gasPrice).toBe(GAS_PRICE);
      expect(signed.encodedTx).toMatchObject({
        params: {
          utxos: [large.ref],
          gasAmount: GAS_AMOUNT,
          gasPrice: GAS_PRICE.toString(),
          destinations: params.destinations,
        },
      });
      expect(JSON.parse(signed.rawTx).unsignedTx).toBe(raw);
      expect(params.utxos).toBeUndefined();
      expect(
        sendProxyRequest.mock.calls.filter(
          ([request]) =>
            request.body[0].params.method === 'postTransactionsBuild',
        ),
      ).toHaveLength(4);
    },
  );

  it.each([
    EDeviceType.Classic1s,
    EDeviceType.ClassicPure,
    EDeviceType.Pro,
    EDeviceType.Pro2,
    EDeviceType.Neo,
  ])(
    'preserves the existing SDK request and returned bytes on %s',
    async (deviceType) => {
      const count =
        deviceType === EDeviceType.Classic1s ||
        deviceType === EDeviceType.ClassicPure
          ? 16
          : 17;
      const {
        keyring,
        signParams,
        encodedTx,
        alephiumSignTransaction,
        sendProxyRequest,
      } = setup(deviceType, count);
      const signed = await keyring.signTransaction(signParams);
      expect(alephiumSignTransaction).toHaveBeenCalledTimes(1);
      const rawTx = alephiumSignTransaction.mock.calls[0][2].rawTx as string;
      expect(alephiumSignTransaction).toHaveBeenCalledWith(
        'connection',
        'device',
        {
          path: "m/44'/1234'/0'/0/0",
          rawTx,
          scriptOpt: undefined,
        },
      );
      expect(
        codec.unsignedTxCodec.decode(Buffer.from(rawTx, 'hex')).inputs,
      ).toHaveLength(count);
      expect(JSON.parse(signed.rawTx)).toEqual({
        unsignedTx: rawTx,
        signature: '11'.repeat(64),
      });
      expect(signed.encodedTx).toBe(encodedTx);
      expect(
        sendProxyRequest.mock.calls.map(
          ([request]) => request.body[0].params.method,
        ),
      ).toEqual(['postTransactionsBuild', 'postTransactionsDecodeUnsignedTx']);
    },
  );

  it.each([
    EDeviceType.Pro,
    EDeviceType.Pro2,
    EDeviceType.Neo,
    EDeviceType.Touch,
  ])(
    'does not add transaction construction to fee estimation on %s',
    async (deviceType) => {
      const { vault, encodedTx, sendProxyRequest } = setup(deviceType);
      await expect(
        vault.buildEstimateFeeParams({ encodedTx }),
      ).resolves.toMatchObject({
        encodedTx: { type: 'buildTransferTx', fromPublicKey: PUBLIC_KEY },
      });
      expect(sendProxyRequest).not.toHaveBeenCalled();
    },
  );

  it('keeps software fee estimation outside the hardware device check', async () => {
    const { vault, encodedTx, sendProxyRequest, getAccountDeviceSafe } = setup(
      EDeviceType.Classic1s,
      17,
      false,
    );
    await expect(
      vault.buildEstimateFeeParams({ encodedTx }),
    ).resolves.toMatchObject({
      encodedTx: { type: 'buildTransferTx' },
    });
    expect(getAccountDeviceSafe).not.toHaveBeenCalled();
    expect(sendProxyRequest).not.toHaveBeenCalled();
  });
});
