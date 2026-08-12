import { scriptPkToAddress } from '.';

import { Psbt, Transaction } from 'bitcoinjs-lib';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type { ITxInputToSign } from '../../../types';
import type { networks } from 'bitcoinjs-lib';

export type IBatchPsbtAmountInfo = {
  feeValue: string; // satoshi, decimal string
  externalOutValue: string; // satoshi, sum of outputs NOT owned by the account
  changeValue: string; // satoshi, sum of outputs owned by the account
  externalRecipients: string[]; // unique external recipient addresses, in output order
};

// Serializes the psbt's unsigned global tx. Two psbts spending identical
// inputs to identical outputs produce identical hex here regardless of any
// signatures already attached to their inputs, which is what makes this
// usable as a dedupe/conflict key.
export function getPsbtUnsignedTxHex(psbt: Psbt): string {
  return bufferUtils.bytesToHex(psbt.data.globalMap.unsignedTx.toBuffer());
}

// Later occurrences of an identical unsigned tx are reported as duplicates;
// the first occurrence of each unique tx is kept out of the result.
export function findDuplicatePsbtIndexes(psbts: Psbt[]): number[] {
  const seenUnsignedTxHex = new Set<string>();
  const duplicateIndexes: number[] = [];
  psbts.forEach((psbt, index) => {
    const unsignedTxHex = getPsbtUnsignedTxHex(psbt);
    if (seenUnsignedTxHex.has(unsignedTxHex)) {
      duplicateIndexes.push(index);
    } else {
      seenUnsignedTxHex.add(unsignedTxHex);
    }
  });
  return duplicateIndexes;
}

function getPsbtOutpointKeys(psbt: Psbt): string[] {
  return psbt.txInputs.map(
    (input) => `${bufferUtils.bytesToHex(input.hash)}:${input.index}`,
  );
}

// Outpoint keys (see getPsbtOutpointKeys) carry the txid in internal
// (little-endian) byte order. Reverse the txid byte-pairs to the display
// (big-endian) order used by block explorers, for surfacing a conflict's
// outpoint in a user/developer-facing message. The vout suffix passes
// through unchanged. Reverses byte-pair by byte-pair on the hex string
// directly rather than via Buffer#reverse(), since an eslint autofix on the
// mutating array method rewrites it to Uint8Array#toReversed() (a plain
// typed array whose toString() drops the 'hex' encoding argument).
export function outpointToDisplay(outpoint: string): string {
  const [rawTxid, vout] = outpoint.split(':');
  let displayTxid = '';
  for (let i = rawTxid.length - 2; i >= 0; i -= 2) {
    displayTxid += rawTxid.slice(i, i + 2);
  }
  return `${displayTxid}:${vout}`;
}

// A conflict where EVERY involved psbt index is exempt (isBtcWalletProvider,
// e.g. Babylon pre-signed alternative spends of the same staking output) is
// intentionally allowed through and not reported.
export function findPsbtOutpointConflicts({
  psbts,
  exemptIndexes,
}: {
  psbts: Psbt[];
  exemptIndexes: number[];
}): Array<{ outpoint: string; indexes: number[] }> {
  const exemptSet = new Set(exemptIndexes);
  const outpointToPsbtIndexes = new Map<string, number[]>();

  psbts.forEach((psbt, psbtIndex) => {
    // Dedupe outpoints within a single psbt first, so a psbt referencing the
    // same outpoint twice only contributes its index once per outpoint.
    const uniqueOutpointsInPsbt = new Set(getPsbtOutpointKeys(psbt));
    uniqueOutpointsInPsbt.forEach((outpoint) => {
      const indexes = outpointToPsbtIndexes.get(outpoint) ?? [];
      indexes.push(psbtIndex);
      outpointToPsbtIndexes.set(outpoint, indexes);
    });
  });

  const conflicts: Array<{ outpoint: string; indexes: number[] }> = [];
  outpointToPsbtIndexes.forEach((indexes, outpoint) => {
    if (indexes.length <= 1) {
      return;
    }
    const allInvolvedIndexesAreExempt = indexes.every((index) =>
      exemptSet.has(index),
    );
    if (allInvolvedIndexesAreExempt) {
      return;
    }
    conflicts.push({ outpoint, indexes });
  });
  return conflicts;
}

// Strict parsing: any input without a resolvable spent value, or a
// non-positive fee, makes the whole psbt impossible to summarize for the
// batch overview — a negative fee is even legitimate for
// SIGHASH_SINGLE|ANYONECANPAY marketplace listing psbts (seller-side, the
// buyer adds fee inputs later). The caller must never show a made-up
// fee/amount breakdown for such a psbt; it falls back to the legacy
// sequential per-psbt confirm flow instead.
export function computeBatchPsbtAmounts({
  psbt,
  psbtNetwork,
  accountAddresses,
}: {
  psbt: Psbt;
  psbtNetwork: networks.Network;
  accountAddresses: string[];
}): IBatchPsbtAmountInfo | null {
  // A zero-output tx is invalid (and can't happen for a real spend); without
  // this guard the loop below would compute externalOutValue/changeValue as 0
  // and misreport the entire input value as fee.
  if (psbt.txOutputs.length === 0) {
    return null;
  }

  const accountAddressSet = new Set(accountAddresses);

  let totalInValue = 0n;
  for (let index = 0; index < psbt.data.inputs.length; index += 1) {
    const input = psbt.data.inputs[index];
    if (input.witnessUtxo) {
      totalInValue += input.witnessUtxo.value;
    } else if (input.nonWitnessUtxo) {
      const fundingTx = Transaction.fromBuffer(input.nonWitnessUtxo);
      const fundingOutput = fundingTx.outs[psbt.txInputs[index].index];
      if (!fundingOutput) {
        return null;
      }
      totalInValue += fundingOutput.value;
    } else {
      return null;
    }
  }

  let externalOutValue = 0n;
  let changeValue = 0n;
  const externalRecipients: string[] = [];
  const seenExternalRecipients = new Set<string>();

  psbt.txOutputs.forEach((output) => {
    // scriptPkToAddress swallows decode errors (e.g. OP_RETURN outputs) and
    // returns '' instead of throwing, so a falsy address counts as external
    // value with no recipient to surface.
    const address =
      scriptPkToAddress(Buffer.from(output.script), psbtNetwork) || undefined;
    if (address && accountAddressSet.has(address)) {
      changeValue += output.value;
    } else {
      externalOutValue += output.value;
      if (address && !seenExternalRecipients.has(address)) {
        seenExternalRecipients.add(address);
        externalRecipients.push(address);
      }
    }
  });

  const feeValue = totalInValue - externalOutValue - changeValue;
  if (feeValue <= 0n) {
    return null;
  }

  return {
    feeValue: feeValue.toString(),
    externalOutValue: externalOutValue.toString(),
    changeValue: changeValue.toString(),
    externalRecipients,
  };
}

// Mirrors the finalize tail of ProviderApiBtc._signPsbt: finalize the signed
// inputs unless the caller opted out via autoFinalized === false.
export function finalizeSignedPsbtHex({
  signedPsbtHex,
  psbtNetwork,
  inputsToSign,
  autoFinalized,
}: {
  signedPsbtHex: string;
  psbtNetwork: networks.Network;
  inputsToSign: Array<Pick<ITxInputToSign, 'index'>>;
  autoFinalized: boolean | undefined;
}): string {
  if (autoFinalized === false) {
    return signedPsbtHex;
  }
  const psbt = Psbt.fromHex(signedPsbtHex, { network: psbtNetwork });
  inputsToSign.forEach((input) => {
    psbt.finalizeInput(input.index);
  });
  return psbt.toHex();
}
