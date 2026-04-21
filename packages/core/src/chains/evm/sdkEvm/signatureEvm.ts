import { splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { serialize } from '@ethersproject/transactions';

import type { UnsignedTransaction } from '@ethersproject/transactions';

export function buildSignedTxFromSignatureEvm({
  tx,
  signature,
}: {
  tx: UnsignedTransaction;
  signature: {
    v: string | number; // '0x11' , '17', 17
    r: string; // prefix 0x
    s: string; // prefix 0x
  };
}) {
  const { r, s, v } = signature;
  /**
   * sdk legacy return {v,r,s}; eip1559 return {recoveryParam,r,s}
   * splitSignature auto converts v to recoveryParam
   */
  const sig = splitSignature({
    v: Number(v),
    r,
    s,
  });
  const rawTx = serialize(tx, sig);
  const txid = keccak256(rawTx);
  return {
    rawTx,
    txid,
  };
}
