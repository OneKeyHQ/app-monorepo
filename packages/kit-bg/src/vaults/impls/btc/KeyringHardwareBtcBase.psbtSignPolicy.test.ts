/*
yarn jest packages/kit-bg/src/vaults/impls/btc/KeyringHardwareBtcBase.psbtSignPolicy.test.ts

OK-67209: a device decides which inputs it signs and with which sighash type,
and its result is handed back as produced. A SIGHASH_SINGLE request relies on
both being exactly as requested, so the hardware signer refuses it before the
device is asked to sign.
*/
import { Psbt, Transaction, payments } from 'bitcoinjs-lib';

import {
  getBitcoinECPair,
  getBtcForkNetwork,
  initBitcoinEcc,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { KeyringHardwareBtcBase } from './KeyringHardwareBtcBase';
import { KeyringHardwareLedger } from './KeyringHardwareLedger';

import type { ISignTransactionParams } from '../../types';

jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const logger: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => logger,
  });
  return { defaultLogger: logger };
});
jest.mock('../../../providers/backgroundProviders', () => ({
  providerApiLoaders: {},
}));

const psbtNetwork = getBtcForkNetwork('tbtc');
const SIGHASH_SINGLE_ANYONECANPAY =
  Transaction.SIGHASH_SINGLE | Transaction.SIGHASH_ANYONECANPAY;
const SINGLE_REFUSED =
  'SIGHASH_SINGLE is not supported by this wallet for input 0';
// Thrown by the first step after the policy check: reaching it means the
// request passed.
const pastPolicy = new Error('reached the step after the policy check');

initBitcoinEcc();
const keyPair = getBitcoinECPair().makeRandom({ network: psbtNetwork });
const account = payments.p2wpkh({
  pubkey: keyPair.publicKey,
  network: psbtNetwork,
});

function buildParams(sighashType?: number): ISignTransactionParams {
  if (!account.address || !account.output) {
    throw new OneKeyLocalError('failed to build p2wpkh test fixture');
  }
  const psbt = new Psbt({ network: psbtNetwork });
  psbt.addInput({
    hash: '11'.repeat(32),
    index: 0,
    witnessUtxo: { script: account.output, value: 100_000n },
    ...(sighashType === undefined ? {} : { sighashType }),
  });
  psbt.addOutput({ script: account.output, value: 90_000n });
  const encodedTx: IEncodedTxBtc = {
    inputs: [],
    outputs: [],
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: '0',
    psbtHex: psbt.toHex(),
    inputsToSign: [{ index: 0, publicKey: '', address: account.address }],
    txSize: undefined,
  };
  return {
    unsignedTx: { encodedTx },
    password: '',
    deviceParams: {
      dbDevice: { connectId: 'test-connect', deviceId: 'test-device' },
      deviceCommonParams: {},
    },
  } as unknown as ISignTransactionParams;
}

const sharedContext = {
  vault: { getAccount: async () => ({ path: "m/86'/1'/0'" }) },
  getNetwork: async () => ({ isTestnet: true }),
  getCoreApiNetworkInfo: async () => ({ networkChainCode: 'tbtc' }),
  coreApi: { getCoinName: async () => 'Testnet' },
};

function oneKeyHarness() {
  const btcSignPsbt = jest.fn();
  const keyring = Object.assign(
    Object.create(KeyringHardwareBtcBase.prototype) as KeyringHardwareBtcBase,
    sharedContext,
    {
      getHardwareSDKInstance: async () => ({
        btcGetPublicKey: async () => ({
          success: true,
          payload: { root_fingerprint: 1 },
        }),
        btcSignPsbt,
      }),
      resolvePsbtAddressDerivation: async () => {
        throw pastPolicy;
      },
    },
  );
  return { keyring, btcSignPsbt };
}

function ledgerHarness() {
  const btcSignPsbt = jest.fn();
  const keyring = Object.assign(
    Object.create(KeyringHardwareLedger.prototype) as KeyringHardwareLedger,
    sharedContext,
    {
      backgroundApi: {
        serviceThirdPartyHardware: {
          getAdapterForVendor: async () => ({
            hw: {
              btcSignPsbt,
              btcGetMasterFingerprint: async () => {
                throw pastPolicy;
              },
            },
          }),
        },
      },
      resolvePsbtAddressDerivation: async () => {
        throw pastPolicy;
      },
    },
  );
  return { keyring, btcSignPsbt };
}

describe.each([
  { name: 'OneKey', harness: oneKeyHarness },
  { name: 'Ledger', harness: ledgerHarness },
])('$name hardware PSBT signing', ({ harness }) => {
  it.each([Transaction.SIGHASH_SINGLE, SIGHASH_SINGLE_ANYONECANPAY])(
    'refuses SIGHASH_SINGLE (sighash byte %i) before the device signs',
    async (sighashType) => {
      const h = harness();
      await expect(
        h.keyring.signPsbt(buildParams(sighashType)),
      ).rejects.toThrow(SINGLE_REFUSED);
      expect(h.btcSignPsbt).not.toHaveBeenCalled();
    },
  );

  it('refuses SIGHASH_NONE before the device signs', async () => {
    const h = harness();
    await expect(
      h.keyring.signPsbt(buildParams(Transaction.SIGHASH_NONE)),
    ).rejects.toThrow('SIGHASH_NONE is not supported for input 0');
    expect(h.btcSignPsbt).not.toHaveBeenCalled();
  });

  it('lets a request that commits to every output through', async () => {
    const h = harness();
    await expect(h.keyring.signPsbt(buildParams())).rejects.not.toThrow(
      /is not supported/,
    );
  });
});
