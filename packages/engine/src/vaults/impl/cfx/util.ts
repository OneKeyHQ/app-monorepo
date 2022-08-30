import { hexZeroPad } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { Transaction } from 'js-conflux-sdk';

import { Signer } from '../../../proxy';

export async function signTransaction(
  unsignedTx: UnsignedTx,
  signer: Signer,
): Promise<SignedTx> {
  const unsignedTransaction = new Transaction(unsignedTx.payload);
  const digest = keccak256(unsignedTransaction.encode(false));

  const [sig, recoveryParam] = await signer.sign(
    Buffer.from(digest.slice(2), 'hex'),
  );
  const [r, s]: [Buffer, Buffer] = [sig.slice(0, 32), sig.slice(32)];

  const signedTransaction = new Transaction({
    ...unsignedTx.payload,
    r: hexZeroPad(`0x${r.toString('hex')}`, 32),
    s: hexZeroPad(`0x${s.toString('hex')}`, 32),
    v: recoveryParam,
  });

  return {
    txid: signedTransaction.hash,
    rawTx: signedTransaction.serialize(),
  };
}
