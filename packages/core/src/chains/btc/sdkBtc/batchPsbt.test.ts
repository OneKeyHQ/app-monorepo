import { getBitcoinECPair, initBitcoinEcc } from '.';

import { Psbt, payments } from 'bitcoinjs-lib';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  computeBatchPsbtAmounts,
  finalizeSignedPsbtHex,
  findDuplicatePsbtIndexes,
  findPsbtOutpointConflicts,
  getPsbtUnsignedTxHex,
} from './batchPsbt';
import { getBtcForkNetwork } from './networks';

import type { networks } from 'bitcoinjs-lib';

const psbtNetwork: networks.Network = getBtcForkNetwork('tbtc');

// Two distinct fake funding txids (32-byte hex) used across the tests below.
const TXID_A = '11'.repeat(32);
const TXID_B = '22'.repeat(32);

initBitcoinEcc();
const ECPair = getBitcoinECPair();

function makeP2wpkh() {
  const keyPair = ECPair.makeRandom({ network: psbtNetwork });
  const { address, output } = payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: psbtNetwork,
  });
  if (!address || !output) {
    throw new OneKeyLocalError(
      'failed to build p2wpkh payment for test fixture',
    );
  }
  return { address, script: output };
}

function buildPsbt({
  inputs,
  outputs,
}: {
  inputs: Array<{
    txid: string;
    vout: number;
    value: bigint;
    script: Uint8Array;
  }>;
  outputs: Array<{ script: Uint8Array; value: bigint }>;
}): Psbt {
  const psbt = new Psbt({ network: psbtNetwork });
  inputs.forEach((input) => {
    psbt.addInput({
      hash: input.txid,
      index: input.vout,
      witnessUtxo: {
        script: input.script,
        value: input.value,
      },
    });
  });
  outputs.forEach((output) => {
    psbt.addOutput({ script: output.script, value: output.value });
  });
  return psbt;
}

describe('getPsbtUnsignedTxHex', () => {
  it('is identical for two psbts built from identical inputs/outputs, and differs when the input txid differs', () => {
    const { script: fundingScript } = makeP2wpkh();
    const { script: outputScript } = makeP2wpkh();

    const psbtA = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });
    const psbtB = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });
    const psbtC = buildPsbt({
      inputs: [
        { txid: TXID_B, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });

    expect(getPsbtUnsignedTxHex(psbtA)).toBe(getPsbtUnsignedTxHex(psbtB));
    expect(getPsbtUnsignedTxHex(psbtA)).not.toBe(getPsbtUnsignedTxHex(psbtC));
  });
});

describe('findDuplicatePsbtIndexes', () => {
  it('returns the indexes of later occurrences of an identical unsigned tx', () => {
    const { script: fundingScript } = makeP2wpkh();
    const { script: outputScript } = makeP2wpkh();

    const psbtA = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });
    // Same inputs/outputs as psbtA -> duplicate unsigned tx.
    const psbtADup = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });
    const psbtC = buildPsbt({
      inputs: [
        { txid: TXID_B, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });

    expect(findDuplicatePsbtIndexes([psbtA, psbtADup, psbtC])).toEqual([1]);
  });

  it('returns an empty array when no duplicates exist', () => {
    const { script: fundingScript } = makeP2wpkh();
    const { script: outputScript } = makeP2wpkh();

    const psbtA = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });
    const psbtC = buildPsbt({
      inputs: [
        { txid: TXID_B, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });

    expect(findDuplicatePsbtIndexes([psbtA, psbtC])).toEqual([]);
  });
});

describe('findPsbtOutpointConflicts', () => {
  const { script: fundingScript } = makeP2wpkh();
  const { script: outputScript } = makeP2wpkh();

  // psbt0 and psbt1 both spend TXID_A:0; psbt2 spends a distinct outpoint.
  const buildConflictingSet = () => [
    buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    }),
    buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 80_000n }],
    }),
    buildPsbt({
      inputs: [
        { txid: TXID_B, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    }),
  ];

  it('reports a single conflict entry covering the two psbts that spend the same outpoint', () => {
    const psbts = buildConflictingSet();
    const conflicts = findPsbtOutpointConflicts({ psbts, exemptIndexes: [] });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].indexes).toEqual([0, 1]);
  });

  it('suppresses the conflict when every involved index is exempt', () => {
    const psbts = buildConflictingSet();
    const conflicts = findPsbtOutpointConflicts({
      psbts,
      exemptIndexes: [0, 1],
    });
    expect(conflicts).toEqual([]);
  });

  it('still reports the conflict when only one of the two indexes is exempt', () => {
    const psbts = buildConflictingSet();
    const conflicts = findPsbtOutpointConflicts({
      psbts,
      exemptIndexes: [0],
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].indexes).toEqual([0, 1]);
  });
});

describe('computeBatchPsbtAmounts', () => {
  it('splits fee/external/change for a simple p2wpkh spend', () => {
    const { address: accountAddress, script: accountScript } = makeP2wpkh();
    const { address: externalAddress, script: externalScript } = makeP2wpkh();

    const psbt = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: accountScript },
      ],
      outputs: [
        { script: externalScript, value: 60_000n },
        { script: accountScript, value: 30_000n },
      ],
    });

    const result = computeBatchPsbtAmounts({
      psbt,
      psbtNetwork,
      accountAddresses: [accountAddress],
    });

    expect(result).toEqual({
      feeValue: '10000',
      externalOutValue: '60000',
      changeValue: '30000',
      externalRecipients: [externalAddress],
    });
  });

  it('returns null when an input has neither witnessUtxo nor nonWitnessUtxo', () => {
    const { script: accountScript } = makeP2wpkh();
    const psbt = new Psbt({ network: psbtNetwork });
    // No witnessUtxo/nonWitnessUtxo attached -> the input's spent value is
    // unknowable.
    psbt.addInput({ hash: TXID_A, index: 0 });
    psbt.addOutput({ script: accountScript, value: 1000n });

    expect(
      computeBatchPsbtAmounts({ psbt, psbtNetwork, accountAddresses: [] }),
    ).toBeNull();
  });

  it('returns null when outputs exceed inputs (negative fee)', () => {
    const { script: accountScript } = makeP2wpkh();
    const { script: externalScript } = makeP2wpkh();

    const psbt = buildPsbt({
      inputs: [{ txid: TXID_A, vout: 0, value: 1000n, script: accountScript }],
      outputs: [{ script: externalScript, value: 2000n }],
    });

    expect(
      computeBatchPsbtAmounts({ psbt, psbtNetwork, accountAddresses: [] }),
    ).toBeNull();
  });
});

describe('finalizeSignedPsbtHex', () => {
  it('returns the input hex untouched when autoFinalized is false', () => {
    const { script: accountScript } = makeP2wpkh();
    const psbt = buildPsbt({
      inputs: [{ txid: TXID_A, vout: 0, value: 1000n, script: accountScript }],
      outputs: [{ script: accountScript, value: 900n }],
    });
    const signedPsbtHex = psbt.toHex();

    const result = finalizeSignedPsbtHex({
      signedPsbtHex,
      psbtNetwork,
      inputsToSign: [{ index: 0 }],
      autoFinalized: false,
    });

    expect(result).toBe(signedPsbtHex);
  });
});
