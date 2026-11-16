/*
yarn jest packages/kit-bg/src/providers/ProviderApiBtc.psbtSighashPolicy.test.ts

OK-67209 / OK-67286: a dapp PSBT must be refused, before any confirmation is
shown, when the requested signature does not guarantee what the confirm page
would display.
*/
import { Psbt, Transaction, payments } from 'bitcoinjs-lib';

import {
  getBitcoinECPair,
  getBtcForkNetwork,
  initBitcoinEcc,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import ProviderApiBtc from './ProviderApiBtc';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  providerApiMethod: () => () => undefined,
  permissionRequired: () => () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { discovery: { dapp: { dappRequest: jest.fn() } } },
}));
jest.mock('./backgroundProviders', () => ({ providerApiLoaders: {} }));
jest.mock('../states/jotai/atoms', () => ({ perpsActiveAccountAtom: {} }));
// Software keyrings and Keystone release signatures for exactly the requested
// inputs; other devices do not.
const mockIsPsbtSignerBoundToRequest = jest.fn(() => true);
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: async () => ({
      isPsbtSignerBoundToRequest: () => mockIsPsbtSignerBoundToRequest(),
    }),
  },
}));

const psbtNetwork = getBtcForkNetwork('tbtc');
const TXID_VICTIM = '11'.repeat(32);
const TXID_FAKE = '22'.repeat(32);
const SIGHASH_SINGLE_ANYONECANPAY =
  Transaction.SIGHASH_SINGLE | Transaction.SIGHASH_ANYONECANPAY;
const INVALID_PARAMS = -32_602;

initBitcoinEcc();
const ECPair = getBitcoinECPair();

function makeP2wpkh() {
  const keyPair = ECPair.makeRandom({ network: psbtNetwork });
  const { address, output } = payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: psbtNetwork,
  });
  if (!address || !output) {
    throw new OneKeyLocalError('failed to build p2wpkh test fixture');
  }
  return {
    address,
    script: output,
    pub: Buffer.from(keyPair.publicKey).toString('hex'),
  };
}

function buildPsbtHex({
  inputs,
  outputs,
}: {
  inputs: Array<{
    txid: string;
    vout: number;
    value: bigint;
    script: Uint8Array;
    sighashType?: number;
  }>;
  outputs: Array<{ script: Uint8Array; value: bigint }>;
}): string {
  const psbt = new Psbt({ network: psbtNetwork });
  inputs.forEach((input) => {
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      witnessUtxo: { script: input.script, value: input.value },
      ...(input.sighashType === undefined
        ? {}
        : { sighashType: input.sighashType }),
    });
  });
  outputs.forEach((output) => {
    psbt.addOutput({ script: output.script, value: output.value });
  });
  return psbt.toHex();
}

const victim = makeP2wpkh();
const victimOtherAddress = makeP2wpkh();
const attacker = makeP2wpkh();
const decoy = makeP2wpkh();

const approval = new Error('confirmation reached');

function setup() {
  const account = {
    id: 'hd-1--m/84h/1h/0h',
    address: victim.address,
    pub: victim.pub,
    path: "m/84'/1'/0'",
    addresses: { '0/0': victim.address },
    customAddresses: { '1/0': victimOtherAddress.address },
  };
  const connection = {
    account,
    accountInfo: {
      accountId: account.id,
      networkId: 'tbtc--0',
      address: account.address,
      walletId: 'hd-1',
    },
  };
  const approve = jest.fn(async (_params: unknown): Promise<unknown> => {
    throw approval;
  });
  const createBatch = jest.fn(async (_params: unknown) => ({
    batchId: 'batch-1',
  }));
  const backgroundApi = {
    serviceDApp: {
      dAppGetConnectedAccountsInfo: jest.fn().mockResolvedValue([connection]),
      openSignAndSendTransactionModal: approve,
      openBatchTxConfirmModal: jest.fn(async () => ['signed']),
    },
    serviceBatchTxSign: {
      createBatch,
      disposeBatch: jest.fn(async () => undefined),
    },
    serviceAccount: { getAccount: async () => account },
    serviceSetting: { getEnableBTCFreshAddress: async () => false },
    serviceNetwork: { getNetwork: async () => ({ code: 'tbtc' }) },
  };
  const provider = new ProviderApiBtc({ backgroundApi } as never);
  const request: IJsBridgeMessagePayload = { origin: 'https://dapp.example' };
  const methods = provider as unknown as Record<
    string,
    (request: IJsBridgeMessagePayload, ...params: unknown[]) => Promise<unknown>
  >;
  const run = (method: string, ...params: unknown[]) =>
    methods[method].call(provider, request, ...params);
  const approvedEncodedTx = () =>
    (approve.mock.calls[0][0] as { encodedTx: IEncodedTxBtc }).encodedTx;
  return { run, approve, createBatch, approvedEncodedTx };
}

// The PSBT from the report: SIGHASH_SINGLE|ANYONECANPAY on the victim input,
// an unsigned input that does not exist on chain mirroring the attacker
// output, then a decoy and the change.
const reportedPsbtHex = () =>
  buildPsbtHex({
    inputs: [
      {
        txid: TXID_VICTIM,
        vout: 3,
        value: 1_457_639n,
        script: victim.script,
        sighashType: SIGHASH_SINGLE_ANYONECANPAY,
      },
      { txid: TXID_FAKE, vout: 0, value: 1_455_639n, script: attacker.script },
    ],
    outputs: [
      { script: attacker.script, value: 1_455_639n },
      { script: decoy.script, value: 1000n },
      { script: victim.script, value: 1_454_639n },
    ],
  });

const listingPsbtHex = (payoutScript: Uint8Array = victim.script) =>
  buildPsbtHex({
    inputs: [
      {
        txid: TXID_VICTIM,
        vout: 0,
        value: 100_000n,
        script: victim.script,
        sighashType: SIGHASH_SINGLE_ANYONECANPAY,
      },
    ],
    outputs: [{ script: payoutScript, value: 90_000n }],
  });

const paymentPsbtHex = () =>
  buildPsbtHex({
    inputs: [
      { txid: TXID_VICTIM, vout: 1, value: 100_000n, script: victim.script },
    ],
    outputs: [
      { script: decoy.script, value: 50_000n },
      { script: victim.script, value: 49_000n },
    ],
  });

describe('ProviderApiBtc PSBT sighash policy', () => {
  beforeEach(() => {
    mockIsPsbtSignerBoundToRequest.mockReturnValue(true);
  });

  it('refuses a request that names the same input twice', async () => {
    const h = setup();
    await expect(
      h.run('signPsbt', {
        psbtHex: listingPsbtHex(),
        options: { toSignInputs: [{ index: 0 }, { index: 0 }] },
      }),
    ).rejects.toMatchObject({
      code: INVALID_PARAMS,
      message: expect.stringContaining(
        'Input 0 is requested for signing more than once',
      ),
    });
    expect(h.approve).not.toHaveBeenCalled();
  });

  it('refuses a listing when the signer is not bound to the requested inputs', async () => {
    mockIsPsbtSignerBoundToRequest.mockReturnValue(false);
    const h = setup();
    await expect(
      h.run('signPsbt', { psbtHex: listingPsbtHex() }),
    ).rejects.toMatchObject({
      code: INVALID_PARAMS,
      message: expect.stringContaining(
        'SIGHASH_SINGLE is not supported by this wallet for input 0',
      ),
    });
    expect(h.approve).not.toHaveBeenCalled();

    await expect(h.run('signPsbt', { psbtHex: paymentPsbtHex() })).rejects.toBe(
      approval,
    );
  });

  it('refuses the reported PSBT before any confirmation', async () => {
    const h = setup();
    await expect(
      h.run('signPsbt', { psbtHex: reportedPsbtHex() }),
    ).rejects.toMatchObject({
      code: INVALID_PARAMS,
      message: expect.stringContaining(
        'SIGHASH_SINGLE input 0 must pay its matching output to the signing account',
      ),
    });
    expect(h.approve).not.toHaveBeenCalled();
  });

  it('refuses a SIGHASH_SINGLE payment that leaves its change uncommitted', async () => {
    const h = setup();
    const psbtHex = buildPsbtHex({
      inputs: [
        {
          txid: TXID_VICTIM,
          vout: 0,
          value: 100_000n,
          script: victim.script,
          sighashType: Transaction.SIGHASH_SINGLE,
        },
      ],
      outputs: [
        { script: attacker.script, value: 1000n },
        { script: victim.script, value: 98_000n },
      ],
    });
    await expect(h.run('signPsbt', { psbtHex })).rejects.toMatchObject({
      code: INVALID_PARAMS,
    });
    expect(h.approve).not.toHaveBeenCalled();
  });

  it.each([
    ['the connected address', victim.script],
    ['another address of the account', victimOtherAddress.script],
  ])('lets a listing that pays %s reach confirmation', async (_, script) => {
    const h = setup();
    await expect(
      h.run('signPsbt', { psbtHex: listingPsbtHex(script) }),
    ).rejects.toBe(approval);
    expect(h.approvedEncodedTx().inputsToSign).toEqual([
      expect.objectContaining({
        index: 0,
        sighashTypes: [SIGHASH_SINGLE_ANYONECANPAY],
      }),
    ]);
  });

  it('does not mark an output as hidden because an unsigned input mirrors it', async () => {
    const h = setup();
    const psbtHex = buildPsbtHex({
      inputs: [
        {
          txid: TXID_VICTIM,
          vout: 3,
          value: 1_457_639n,
          script: victim.script,
        },
        {
          txid: TXID_FAKE,
          vout: 0,
          value: 1_455_639n,
          script: attacker.script,
        },
      ],
      outputs: [
        { script: attacker.script, value: 1_455_639n },
        { script: decoy.script, value: 999n },
        { script: victim.script, value: 1_454_639n },
      ],
    });
    await expect(h.run('signPsbt', { psbtHex })).rejects.toBe(approval);
    expect(h.approvedEncodedTx().outputs).toEqual([
      {
        address: attacker.address,
        value: '1455639',
        payload: { isChange: false },
      },
      { address: decoy.address, value: '999', payload: { isChange: false } },
      {
        address: victim.address,
        value: '1454639',
        payload: { isChange: true },
      },
    ]);
  });

  it('confirms a multi-psbt request one by one when a SIGHASH_SINGLE psbt is in it', async () => {
    const h = setup();
    await expect(
      h.run('signPsbts', {
        psbtHexs: [paymentPsbtHex(), listingPsbtHex()],
      }),
    ).rejects.toBe(approval);
    expect(h.createBatch).not.toHaveBeenCalled();
    expect(h.approve).toHaveBeenCalledTimes(1);
  });

  it('keeps the batch overview for psbts that commit to every output', async () => {
    const h = setup();
    const secondPaymentPsbtHex = buildPsbtHex({
      inputs: [
        { txid: TXID_VICTIM, vout: 2, value: 80_000n, script: victim.script },
      ],
      outputs: [
        { script: decoy.script, value: 30_000n },
        { script: victim.script, value: 49_000n },
      ],
    });
    await expect(
      h.run('signPsbts', {
        psbtHexs: [paymentPsbtHex(), secondPaymentPsbtHex],
      }),
    ).resolves.toEqual(['signed']);
    expect(h.createBatch).toHaveBeenCalledTimes(1);
    expect(h.approve).not.toHaveBeenCalled();
  });
});
