/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { keccak256 } from '@ethersproject/keccak256';
import TronWeb from 'tronweb';

import { uncompressPublicKey } from '@onekeyhq/engine/src/secret';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';

import type { Signer } from '../../../proxy';

export function publicKeyToAddress(publicKey: string): string {
  const uncompressed = uncompressPublicKey(
    'secp256k1',
    Buffer.from(publicKey, 'hex'),
  );
  return TronWeb.address.fromHex(
    `41${keccak256(uncompressed.slice(-64)).slice(-40)}`,
  );
}

export async function signTransaction(
  unsignedTx: UnsignedTx,
  signer: Signer,
): Promise<SignedTx> {
  const { encodedTx } = unsignedTx.payload;
  const [sig, recoveryParam] = await signer.sign(
    Buffer.from(encodedTx.txID, 'hex'),
  );

  return Promise.resolve({
    txid: encodedTx.txID,
    rawTx: JSON.stringify({
      ...encodedTx,
      signature: [
        Buffer.concat([sig, Buffer.from([recoveryParam])]).toString('hex'),
      ],
    }),
  });
}
