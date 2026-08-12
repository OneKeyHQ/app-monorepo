import { getBitcoinECPair, initBitcoinEcc } from '.';

import { Psbt, Transaction, payments } from 'bitcoinjs-lib';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  buildOwnedAddressesForBatchDisplay,
  computeBatchPsbtAmounts,
  finalizeSignedPsbtHex,
  findDuplicatePsbtIndexes,
  findPsbtOutpointConflicts,
  getPsbtUnsignedTxHex,
  outpointToDisplay,
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

  it('is keyed on the unsigned tx, not the full psbt hex, so per-input metadata differences do not defeat dedupe', () => {
    const { script: fundingScript } = makeP2wpkh();
    const { script: outputScript } = makeP2wpkh();

    const psbtA = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });
    const psbtADup = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: fundingScript },
      ],
      outputs: [{ script: outputScript, value: 90_000n }],
    });
    // Attaching per-input metadata changes the full psbt hex (it's stored in
    // a separate keyvalue map from the global unsigned tx) but must not
    // affect the unsigned-tx-keyed dedupe below.
    psbtADup.updateInput(0, { sighashType: Transaction.SIGHASH_ALL });

    expect(psbtA.toHex()).not.toBe(psbtADup.toHex());
    expect(findDuplicatePsbtIndexes([psbtA, psbtADup])).toEqual([1]);
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

  it('returns null for a psbt with zero outputs', () => {
    const { script: accountScript } = makeP2wpkh();
    const psbt = new Psbt({ network: psbtNetwork });
    psbt.addInput({
      hash: TXID_A,
      index: 0,
      witnessUtxo: { script: accountScript, value: 1000n },
    });
    // No addOutput call -> a zero-output tx, which is invalid and must not
    // be reported as a valid all-fee summary.

    expect(
      computeBatchPsbtAmounts({ psbt, psbtNetwork, accountAddresses: [] }),
    ).toBeNull();
  });

  it('handles an all-change consolidation spend (no external output)', () => {
    const { address: accountAddress, script: accountScript } = makeP2wpkh();

    const psbt = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: accountScript },
      ],
      outputs: [{ script: accountScript, value: 95_000n }],
    });

    const result = computeBatchPsbtAmounts({
      psbt,
      psbtNetwork,
      accountAddresses: [accountAddress],
    });

    expect(result).toEqual({
      feeValue: '5000',
      externalOutValue: '0',
      changeValue: '95000',
      externalRecipients: [],
    });
  });
});

describe('buildOwnedAddressesForBatchDisplay', () => {
  it('merges primary, derived, custom and claimed addresses with dedupe', () => {
    const owned = buildOwnedAddressesForBatchDisplay({
      primaryAddress: 'addr-primary',
      addressMaps: [
        // derived map repeats the primary address under its relPath
        { '0/0': 'addr-primary', '0/1': 'addr-derived' },
        { '0/2': 'addr-custom' },
        { '0/100': 'addr-claimed' },
      ],
    });
    expect(owned).toEqual([
      'addr-primary',
      'addr-derived',
      'addr-custom',
      'addr-claimed',
    ]);
  });

  it('skips undefined maps and empty address values', () => {
    const owned = buildOwnedAddressesForBatchDisplay({
      primaryAddress: 'addr-primary',
      addressMaps: [undefined, { '0/1': '' }, undefined],
    });
    expect(owned).toEqual(['addr-primary']);
  });
});

describe('computeBatchPsbtAmounts - wallet-owned output classification', () => {
  // One case per wallet-owned address source: change sent to a derived,
  // custom, or claimed (find-address) address must be classified as change,
  // not as an external transfer inflating the displayed outgoing total.
  it.each(['derived', 'custom', 'claimed'] as const)(
    'counts an output to a %s wallet address as change',
    (source) => {
      const { address: primaryAddress, script: primaryScript } = makeP2wpkh();
      const { address: ownedAddress, script: ownedScript } = makeP2wpkh();
      const { address: externalAddress, script: externalScript } = makeP2wpkh();

      const addressMaps = {
        derived: [{ '0/1': ownedAddress }, undefined, undefined],
        custom: [undefined, { '0/2': ownedAddress }, undefined],
        claimed: [undefined, undefined, { '0/100': ownedAddress }],
      }[source];

      const psbt = buildPsbt({
        inputs: [
          { txid: TXID_A, vout: 0, value: 100_000n, script: primaryScript },
        ],
        outputs: [
          { script: externalScript, value: 50_000n },
          { script: ownedScript, value: 40_000n },
        ],
      });

      const result = computeBatchPsbtAmounts({
        psbt,
        psbtNetwork,
        accountAddresses: buildOwnedAddressesForBatchDisplay({
          primaryAddress,
          addressMaps,
        }),
      });

      expect(result).toEqual({
        feeValue: '10000',
        externalOutValue: '50000',
        changeValue: '40000',
        externalRecipients: [externalAddress],
      });
    },
  );

  it('still counts the same output as external when the ownership set only has the primary address', () => {
    const { address: primaryAddress, script: primaryScript } = makeP2wpkh();
    const { address: ownedAddress, script: ownedScript } = makeP2wpkh();

    const psbt = buildPsbt({
      inputs: [
        { txid: TXID_A, vout: 0, value: 100_000n, script: primaryScript },
      ],
      outputs: [{ script: ownedScript, value: 90_000n }],
    });

    const result = computeBatchPsbtAmounts({
      psbt,
      psbtNetwork,
      accountAddresses: [primaryAddress],
    });

    expect(result).toEqual({
      feeValue: '10000',
      externalOutValue: '90000',
      changeValue: '0',
      externalRecipients: [ownedAddress],
    });
  });
});

describe('computeBatchPsbtAmounts - nonWitnessUtxo branch', () => {
  it('resolves the input value via nonWitnessUtxo when witnessUtxo is absent', () => {
    const { address: accountAddress, script: accountScript } = makeP2wpkh();
    const { address: externalAddress, script: externalScript } = makeP2wpkh();

    const fundingTx = new Transaction();
    fundingTx.addInput(Buffer.alloc(32), 0xff_ff_ff_ff);
    fundingTx.addOutput(accountScript, 100_000n);

    const psbt = new Psbt({ network: psbtNetwork });
    // bitcoinjs validates (at signing time) that the nonWitnessUtxo's txid
    // matches the input hash, so the input hash must be the funding tx's
    // real hash rather than an arbitrary placeholder.
    psbt.addInput({
      hash: fundingTx.getHash(),
      index: 0,
      nonWitnessUtxo: fundingTx.toBuffer(),
    });
    psbt.addOutput({ script: externalScript, value: 60_000n });
    psbt.addOutput({ script: accountScript, value: 30_000n });

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

  it('returns null when the referenced vout is out of range for the funding tx', () => {
    const { script: accountScript } = makeP2wpkh();
    const { script: externalScript } = makeP2wpkh();

    const fundingTx = new Transaction();
    fundingTx.addInput(Buffer.alloc(32), 0xff_ff_ff_ff);
    // Only output index 0 exists.
    fundingTx.addOutput(accountScript, 100_000n);

    const psbt = new Psbt({ network: psbtNetwork });
    psbt.addInput({
      hash: fundingTx.getHash(),
      index: 5,
      nonWitnessUtxo: fundingTx.toBuffer(),
    });
    psbt.addOutput({ script: externalScript, value: 1000n });

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

describe('outpointToDisplay', () => {
  it('reverses a short txid byte-pair by byte-pair and keeps the vout suffix', () => {
    expect(outpointToDisplay('aabbcc:1')).toBe('ccbbaa:1');
  });

  it('reverses a realistic 32-byte txid to display (big-endian) order', () => {
    const rawTxid = Array.from({ length: 32 }, (_, i) =>
      i.toString(16).padStart(2, '0'),
    ).join('');
    const expectedDisplayTxid = Array.from({ length: 32 }, (_, i) =>
      (31 - i).toString(16).padStart(2, '0'),
    ).join('');

    expect(outpointToDisplay(`${rawTxid}:2`)).toBe(`${expectedDisplayTxid}:2`);
  });
});
