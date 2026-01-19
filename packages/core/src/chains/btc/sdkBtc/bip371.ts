import { payments } from 'bitcoinjs-lib';

import type { PsbtInput } from 'bip174';

// The methods in bip371 cannot be exported in the new version of bitcoinjs-lib, so they are written here.

export const toXOnly = (pubKey: Uint8Array) =>
  pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);

function isPaymentFactory(payment: any): (script: Uint8Array) => boolean {
  return (script: Uint8Array): boolean => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      payment({ output: script });
      return true;
    } catch (_err) {
      return false;
    }
  };
}

export const isP2TR = isPaymentFactory(payments.p2tr);

export function isTaprootInput(input: PsbtInput): boolean {
  return (
    input &&
    !!(
      input.tapInternalKey ||
      input.tapMerkleRoot ||
      (input.tapLeafScript && input.tapLeafScript.length) ||
      (input.tapBip32Derivation && input.tapBip32Derivation.length) ||
      (input.witnessUtxo && isP2TR(input.witnessUtxo.script))
    )
  );
}
