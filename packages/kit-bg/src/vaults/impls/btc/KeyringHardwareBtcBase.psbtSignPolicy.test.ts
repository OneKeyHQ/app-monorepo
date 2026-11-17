/*
yarn jest packages/kit-bg/src/vaults/impls/btc/KeyringHardwareBtcBase.psbtSignPolicy.test.ts

OK-67209: a device decides which inputs it signs and with which sighash type.
A SIGHASH_SINGLE request relies on both being exactly as requested, so the
hardware signer refuses it before the device is asked to sign. It also refuses
an account input outside the request that does not commit to every output, and
releases no signature the device adds to an input outside the request.
*/
import { Psbt, Transaction, payments } from 'bitcoinjs-lib';

import {
  getBitcoinECPair,
  getBtcForkNetwork,
  initBitcoinEcc,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import { toXOnly } from '@onekeyhq/core/src/chains/btc/sdkBtc/bip371';
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
jest.mock('../../base/ledgerFingerprintUtils', () => ({
  ...jest.requireActual<Record<string, unknown>>(
    '../../base/ledgerFingerprintUtils',
  ),
  callLedgerWithFingerprint: async (
    _backgroundApi: unknown,
    _dbDevice: unknown,
    _chain: unknown,
    fn: (deviceId: string, connectId: string, context: object) => unknown,
  ) => fn('test-device', 'test-connect', {}),
}));

const psbtNetwork = getBtcForkNetwork('tbtc');
const SIGHASH_SINGLE_ANYONECANPAY =
  Transaction.SIGHASH_SINGLE | Transaction.SIGHASH_ANYONECANPAY;
const SIGHASH_NONE_ANYONECANPAY =
  Transaction.SIGHASH_NONE | Transaction.SIGHASH_ANYONECANPAY;
const SINGLE_REFUSED =
  'SIGHASH_SINGLE is not supported by this wallet for input 0';
// Thrown by the first step after the policy check: reaching it means the
// request passed.
const pastPolicy = new Error('reached the step after the policy check');

initBitcoinEcc();
const keyPair = getBitcoinECPair().makeRandom({ network: psbtNetwork });
// Hardware PSBT signing is taproot only.
const account = payments.p2tr({
  internalPubkey: toXOnly(Buffer.from(keyPair.publicKey)),
  network: psbtNetwork,
});

// Only input 0 is requested. `outsideRequest` adds a second account input
// that the request does not name.
function buildParams(
  sighashType?: number,
  outsideRequest?: { sighashType?: number },
): ISignTransactionParams {
  if (!account.address || !account.output) {
    throw new OneKeyLocalError('failed to build p2tr test fixture');
  }
  const psbt = new Psbt({ network: psbtNetwork });
  psbt.addInput({
    hash: '11'.repeat(32),
    index: 0,
    witnessUtxo: { script: account.output, value: 100_000n },
    ...(sighashType === undefined ? {} : { sighashType }),
  });
  if (outsideRequest) {
    psbt.addInput({
      hash: '11'.repeat(32),
      index: 1,
      witnessUtxo: { script: account.output, value: 5_000_000n },
      ...(outsideRequest.sighashType === undefined
        ? {}
        : { sighashType: outsideRequest.sighashType }),
    });
  }
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
    // A dapp psbt is signed and handed back, never broadcast by the wallet.
    signOnly: true,
    password: '',
    deviceParams: {
      dbDevice: { connectId: 'test-connect', deviceId: 'test-device' },
      deviceCommonParams: {},
    },
  } as unknown as ISignTransactionParams;
}

const derivation = {
  resolvePubkeyHexByAddress: () =>
    Buffer.from(keyPair.publicKey).toString('hex'),
  resolvePathByAddress: () => "m/86'/1'/0'/0/0",
};
// A device that signs every input of the PSBT it is sent.
function signEveryInput(psbtHex: string) {
  const psbt = Psbt.fromHex(psbtHex, { network: psbtNetwork });
  psbt.data.inputs.forEach((input) => {
    input.tapKeySig = Buffer.alloc(64, 1);
  });
  return psbt.toHex();
}

const sharedContext = {
  vault: {
    getAccount: async () => ({
      path: "m/86'/1'/0'",
      address: account.address,
    }),
  },
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
  const letDeviceSignEveryInput = () => {
    Object.assign(keyring, {
      resolvePsbtAddressDerivation: async () => derivation,
    });
    btcSignPsbt.mockImplementation(
      async (
        _connectId: string,
        _deviceId: string,
        params: { psbt: string },
      ) => ({
        success: true,
        payload: { psbt: signEveryInput(params.psbt) },
      }),
    );
  };
  return { keyring, btcSignPsbt, letDeviceSignEveryInput };
}

function ledgerHarness() {
  const btcSignPsbt = jest.fn();
  const btcGetMasterFingerprint = jest.fn(async (): Promise<unknown> => {
    throw pastPolicy;
  });
  const keyring = Object.assign(
    Object.create(KeyringHardwareLedger.prototype) as KeyringHardwareLedger,
    sharedContext,
    {
      backgroundApi: {
        serviceThirdPartyHardware: {
          getAdapterForVendor: async () => ({
            hw: { btcSignPsbt, btcGetMasterFingerprint },
          }),
        },
      },
      resolvePsbtAddressDerivation: async () => {
        throw pastPolicy;
      },
    },
  );
  const letDeviceSignEveryInput = () => {
    Object.assign(keyring, {
      resolvePsbtAddressDerivation: async () => derivation,
    });
    btcGetMasterFingerprint.mockResolvedValue({
      success: true,
      payload: { masterFingerprint: '00000001' },
    });
    btcSignPsbt.mockImplementation(
      async (
        _connectId: string,
        _deviceId: string,
        params: { psbt: string },
      ) => ({
        success: true,
        payload: { signedPsbt: signEveryInput(params.psbt) },
      }),
    );
  };
  return { keyring, btcSignPsbt, letDeviceSignEveryInput };
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
    await expect(h.keyring.signPsbt(buildParams())).rejects.toBe(pastPolicy);
  });

  it('refuses an account input outside the request that does not commit to every output', async () => {
    const h = harness();
    await expect(
      h.keyring.signPsbt(
        buildParams(undefined, { sighashType: SIGHASH_NONE_ANYONECANPAY }),
      ),
    ).rejects.toThrow(
      'Input 1 is outside the signing request and must not declare sighash type 0x82',
    );
    expect(h.btcSignPsbt).not.toHaveBeenCalled();
  });

  it('releases no signature the device adds to an input outside the request', async () => {
    const h = harness();
    h.letDeviceSignEveryInput();
    const signedTx = await h.keyring.signPsbt(buildParams(undefined, {}));

    expect(h.btcSignPsbt).toHaveBeenCalledTimes(1);
    const released = Psbt.fromHex(signedTx.psbtHex ?? '', {
      network: psbtNetwork,
    });
    expect(released.data.inputs[0].tapKeySig).toBeDefined();
    expect(released.data.inputs[1].tapKeySig).toBeUndefined();
    const finalized = Psbt.fromHex(signedTx.finalizedPsbtHex ?? '', {
      network: psbtNetwork,
    });
    expect(finalized.data.inputs[1].tapKeySig).toBeUndefined();
    expect(finalized.data.inputs[1].finalScriptWitness).toBeUndefined();
  });
});
