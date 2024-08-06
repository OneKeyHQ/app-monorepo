import { isEqual } from 'lodash';

import type { Psbt } from 'bitcoinjs-lib';

export function verifyBtcSignedPsbtMatched({
  unsignedPsbt,
  signedPsbt,
}: {
  unsignedPsbt: Psbt | undefined;
  signedPsbt: Psbt | undefined;
}) {
  if (!unsignedPsbt || !signedPsbt) {
    throw new Error('psbt not found');
  }
  const isEqualFn = isEqual;
  if (!isEqualFn(unsignedPsbt.txInputs, signedPsbt.txInputs)) {
    throw new Error('psbt inputs not matched');
  }
  if (!isEqualFn(unsignedPsbt.txOutputs, signedPsbt.txOutputs)) {
    throw new Error('psbt outputs not matched');
  }
  if (!isEqualFn(unsignedPsbt.data.globalMap, signedPsbt.data.globalMap)) {
    throw new Error('psbt uuid not matched');
  }
}
