import { Psbt, Transaction, payments } from 'bitcoinjs-lib';

import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc/networks';

import { vaultFactory } from '../vaults/factory';

import ProviderApiBtc from './ProviderApiBtc';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { discovery: { dapp: { dappRequest: jest.fn() } } },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));
jest.mock('./ProviderApiBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

const network = getBtcForkNetwork('tbtc');
const payment = payments.p2wpkh({ hash: Buffer.alloc(20, 1), network });
const script = payment.output!;
const request = {
  origin: 'https://psbt-regression.example',
  scope: 'btc',
} as IJsBridgeMessagePayload;

function makePsbt(
  kind: 'valid' | 'conflict' | 'missing',
  finalized = false,
  parentSeed = 3,
) {
  const parent = new Transaction();
  parent.addInput(Buffer.alloc(32, parentSeed), 0);
  parent.addOutput(script, 100_000n);
  const psbt = new Psbt({ network });
  psbt.addInput({
    hash: parent.getHash(),
    index: 0,
    nonWitnessUtxo: parent.toBuffer(),
    ...(kind === 'conflict' ? { witnessUtxo: { script, value: 99_100n } } : {}),
    ...(finalized ? { finalScriptWitness: Uint8Array.from([0]) } : {}),
  });
  if (kind === 'missing') {
    psbt.addInput({
      hash: Buffer.alloc(32, 4),
      index: 0,
      finalScriptWitness: Uint8Array.from([0]),
    });
  }
  psbt.addOutput({ script, value: 99_000n });
  return psbt.toHex();
}

function setup(accountId = 'hd-fee-test') {
  const openModal = jest.fn().mockResolvedValue({ psbtHex: makePsbt('valid') });
  const createBatch = jest.fn();
  const provider = new ProviderApiBtc({
    backgroundApi: {
      serviceAccount: {
        getAccount: jest.fn().mockResolvedValue({
          address: payment.address,
          path: "m/84'/1'/0'/0/0",
          pub: '031b84c5567b126440995d3ed5aaba0565d71e1834604819ff9c17f5e9d5dd078f',
        }),
      },
      serviceNetwork: {
        getNetwork: jest.fn().mockResolvedValue({ code: 'tbtc' }),
      },
      serviceDApp: { openSignAndSendTransactionModal: openModal },
      serviceBatchTxSign: { createBatch },
    },
  });
  Object.defineProperties(provider, {
    checkIfEnableConnect: { value: jest.fn().mockResolvedValue(undefined) },
    getAccountsInfo: {
      value: jest.fn().mockResolvedValue([
        {
          accountInfo: {
            accountId,
            networkId: 'tbtc--0',
            address: payment.address,
          },
        },
      ]),
    },
  });
  return { provider, openModal, createBatch };
}

describe.each(['conflict', 'missing'] as const)(
  'rejecting %s PSBT metadata',
  (kind) => {
    it('rejects single signing before the confirmation modal', async () => {
      const { provider, openModal } = setup();
      await expect(
        provider.signPsbt(request, { psbtHex: makePsbt(kind) }),
      ).rejects.toThrow(/UTXO/);
      expect(openModal).not.toHaveBeenCalled();
    });

    it.each(['hd-fee-test', 'qr-fee-test'])(
      'rejects multi-PSBT signing for %s before confirming the invalid item',
      async (accountId) => {
        const { provider, openModal, createBatch } = setup(accountId);
        await expect(
          provider.signPsbts(request, {
            psbtHexs: [makePsbt(kind), makePsbt('valid', false, 5)],
            options: {},
          }),
        ).rejects.toThrow(/UTXO/);
        expect(openModal).not.toHaveBeenCalled();
        expect(createBatch).not.toHaveBeenCalled();
      },
    );

    it('rejects the invalid item even after duplicate-transaction fallback', async () => {
      const { provider, openModal } = setup();
      const hex = makePsbt(kind);
      await expect(
        provider.signPsbts(request, { psbtHexs: [hex, hex], options: {} }),
      ).rejects.toThrow(/UTXO/);
      expect(openModal).not.toHaveBeenCalled();
    });

    it('rejects extraction before requesting a vault or broadcasting', async () => {
      const { provider } = setup();
      jest.mocked(vaultFactory.getVault).mockClear();
      await expect(
        provider.pushPsbt(request, { psbtHex: makePsbt(kind, true) }),
      ).rejects.toThrow(/UTXO|Utxo/);
      expect(vaultFactory.getVault).not.toHaveBeenCalled();
    });
  },
);

it('keeps valid single signing with autoFinalized disabled', async () => {
  const { provider, openModal } = setup();
  const hex = makePsbt('valid');
  await expect(
    provider.signPsbt(request, {
      psbtHex: hex,
      options: { autoFinalized: false },
    }),
  ).resolves.toBe(hex);
  expect(openModal).toHaveBeenCalledWith(
    expect.objectContaining({
      encodedTx: expect.objectContaining({ fee: '1000' }),
      signOnly: true,
    }),
  );
});
