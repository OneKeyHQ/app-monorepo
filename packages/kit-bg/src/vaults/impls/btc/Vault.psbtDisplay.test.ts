/*
yarn jest packages/kit-bg/src/vaults/impls/btc/Vault.psbtDisplay.test.ts

OK-67209 / OK-67286: the confirm page of a PSBT must show what the requested
signatures actually commit to. BTC has no server simulation, so this local
decode is the only thing the user sees before signing.
*/
import { Psbt, Transaction, payments } from 'bitcoinjs-lib';

import {
  getBitcoinECPair,
  getBtcForkNetwork,
  initBitcoinEcc,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type {
  IBtcOutput,
  IEncodedTxBtc,
} from '@onekeyhq/core/src/chains/btc/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import VaultBtc from './Vault';

// Importing the vault pulls in the localDb singleton, whose constructor opens
// IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

const psbtNetwork = getBtcForkNetwork('tbtc');
const TXID_VICTIM = '11'.repeat(32);
const TXID_FAKE = '22'.repeat(32);
const SIGHASH_SINGLE_ANYONECANPAY =
  Transaction.SIGHASH_SINGLE | Transaction.SIGHASH_ANYONECANPAY;
const SIGHASH_ALL_ANYONECANPAY =
  Transaction.SIGHASH_ALL | Transaction.SIGHASH_ANYONECANPAY;

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
  return { address, script: output, pubkey: keyPair.publicKey };
}

const victim = makeP2wpkh();
const attacker = makeP2wpkh();
const decoy = makeP2wpkh();
// pay-to-pubkey: spendable by the attacker, not representable as an address
const attackerP2pkScript = payments.p2pk({
  pubkey: attacker.pubkey,
  network: psbtNetwork,
}).output as Uint8Array;

type ITestInput = {
  txid: string;
  vout: number;
  value: bigint;
  script: Uint8Array;
  address: string;
  sighashType?: number;
};
type ITestOutput = {
  script: Uint8Array;
  value: bigint;
  address: string;
  payload?: IBtcOutput['payload'];
};

// Shape ProviderApiBtc hands to the confirm page for a dapp psbt.
function buildUnsignedTx({
  inputs,
  outputs,
  signIndexes = [0],
}: {
  inputs: ITestInput[];
  outputs: ITestOutput[];
  signIndexes?: number[];
}): IUnsignedTxPro {
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
  const encodedTx: IEncodedTxBtc = {
    inputs: inputs.map((input) => ({
      txid: input.txid,
      vout: input.vout,
      value: input.value.toString(),
      address: input.address,
      path: '',
    })),
    outputs: outputs.map((output) => ({
      address: output.address,
      value: output.value.toString(),
      payload: output.payload,
    })),
    inputsForCoinSelect: [],
    outputsForCoinSelect: [],
    fee: '2000',
    inputsToSign: signIndexes.map((index) => ({
      index,
      publicKey: '',
      address: victim.address,
    })),
    psbtHex: psbt.toHex(),
    disabledCoinSelect: true,
    txSize: undefined,
  };
  return { encodedTx };
}

function buildVault() {
  const vault = Object.create(VaultBtc.prototype) as VaultBtc;
  Object.assign(vault, {
    accountId: 'hd-1--m/84h/1h/0h',
    networkId: 'tbtc--0',
    getNetwork: async () => ({
      code: 'tbtc',
      decimals: 8,
      symbol: 'TBTC',
      feeMeta: { decimals: 8 },
    }),
    getAccount: async () => ({
      address: victim.address,
      addresses: { '0/0': victim.address },
    }),
    backgroundApi: {
      serviceToken: {
        getToken: async () => ({ name: 'Bitcoin', logoURI: '' }),
      },
    },
    _collectUTXOsInfoByApi: async () => ({
      allUtxoList: [{ txid: TXID_VICTIM, vout: 0 }],
    }),
  });
  return vault;
}

async function decode(unsignedTx: IUnsignedTxPro) {
  const decodedTx = await buildVault().buildDecodedPsbtTx({ unsignedTx });
  const transfer = decodedTx.actions[0].assetTransfer;
  return {
    decodedTx,
    sends: transfer?.sends.map(({ to, amount }) => ({ to, amount })),
    receives: transfer?.receives.map(({ to, amount }) => ({ to, amount })),
  };
}

const victimInput = (value: bigint, sighashType?: number): ITestInput => ({
  txid: TXID_VICTIM,
  vout: 0,
  value,
  script: victim.script,
  address: victim.address,
  sighashType,
});
const change = (value: bigint): ITestOutput => ({
  script: victim.script,
  value,
  address: victim.address,
  payload: { isChange: true },
});

describe('VaultBtc.buildDecodedPsbtTx', () => {
  it('shows an external output even if it is flagged as inscription structure', async () => {
    // An unsigned input mirroring the attacker output used to earn it this
    // flag, and the flag used to drop it from the confirm page.
    const { sends, receives, decodedTx } = await decode(
      buildUnsignedTx({
        inputs: [
          victimInput(1_457_639n),
          {
            txid: TXID_FAKE,
            vout: 0,
            value: 1_455_639n,
            script: attacker.script,
            address: attacker.address,
          },
        ],
        outputs: [
          {
            script: attacker.script,
            value: 1_455_639n,
            address: attacker.address,
            payload: { isChange: false, isInscriptionStructure: true },
          },
          {
            script: decoy.script,
            value: 1000n,
            address: decoy.address,
            payload: { isChange: false },
          },
          change(1_454_639n),
        ],
      }),
    );
    expect(sends).toEqual([
      { to: attacker.address, amount: '0.01455639' },
      { to: decoy.address, amount: '0.00001' },
    ]);
    expect(receives).toEqual([]);
    expect(decodedTx.nativeAmountValue).toBe('1456639');
    expect(decodedTx.localAlerts ?? []).toEqual([]);
  });

  it('shows and flags a valued output that has no address', async () => {
    const { sends, decodedTx } = await decode(
      buildUnsignedTx({
        inputs: [victimInput(100_000n)],
        outputs: [
          { script: attackerP2pkScript, value: 90_000n, address: '' },
          { script: decoy.script, value: 1000n, address: decoy.address },
          change(7000n),
        ],
      }),
    );
    expect(sends).toEqual([
      { to: '', amount: '0.0009' },
      { to: decoy.address, amount: '0.00001' },
    ]);
    expect(decodedTx.nativeAmountValue).toBe('91000');
    expect(decodedTx.localAlerts).toHaveLength(1);
  });

  it('shows a listing as the input given up and the matching output received', async () => {
    const { sends, receives, decodedTx } = await decode(
      buildUnsignedTx({
        inputs: [victimInput(546n, SIGHASH_SINGLE_ANYONECANPAY)],
        outputs: [
          {
            script: victim.script,
            value: 1_000_000n,
            address: victim.address,
          },
        ],
      }),
    );
    expect(sends).toEqual([{ to: '', amount: '0.00000546' }]);
    expect(receives).toEqual([{ to: victim.address, amount: '0.01' }]);
    expect(decodedTx.localAlerts).toHaveLength(1);
  });

  it('warns when other parties can still add inputs', async () => {
    const { sends, decodedTx } = await decode(
      buildUnsignedTx({
        inputs: [victimInput(100_000n, SIGHASH_ALL_ANYONECANPAY)],
        outputs: [
          { script: decoy.script, value: 50_000n, address: decoy.address },
          change(49_000n),
        ],
      }),
    );
    expect(sends).toEqual([{ to: decoy.address, amount: '0.0005' }]);
    expect(decodedTx.localAlerts).toHaveLength(1);
  });

  it('refuses to decode the reported PSBT', async () => {
    await expect(
      decode(
        buildUnsignedTx({
          inputs: [
            victimInput(1_457_639n, SIGHASH_SINGLE_ANYONECANPAY),
            {
              txid: TXID_FAKE,
              vout: 0,
              value: 1_455_639n,
              script: attacker.script,
              address: attacker.address,
            },
          ],
          outputs: [
            {
              script: attacker.script,
              value: 1_455_639n,
              address: attacker.address,
            },
            { script: decoy.script, value: 1000n, address: decoy.address },
            change(1_454_639n),
          ],
        }),
      ),
    ).rejects.toThrow(
      'SIGHASH_SINGLE input 0 must pay its matching output to the signing account',
    );
  });
});
