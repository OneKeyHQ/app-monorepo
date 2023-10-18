import {
  encode as toCfxAddress,
  decode as toEthAddress,
} from '@conflux-dev/conflux-address-js';
import { hexZeroPad } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';

import type { ISigner } from '@onekeyhq/engine/src/types/secret';
import type { IEncodedTxCfx } from '@onekeyhq/engine/src/vaults/impl/cfx/types';
import type {
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/engine/src/vaults/types';

import { conflux } from './conflux';

export * from './conflux';

export { hexZeroPad, keccak256 };

export function ethAddressToCfxAddress(address: string): string {
  return `0x1${address.toLowerCase().slice(1)}`;
}

export function pubkeyToCfxAddress(
  uncompressPubKey: Buffer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  chainId: string,
): Promise<string> {
  const pubkey = uncompressPubKey.slice(1);
  const ethAddress = ethAddressToCfxAddress(keccak256(pubkey).slice(-40));
  const networkID = parseInt(chainId);
  return Promise.resolve(toCfxAddress(ethAddress, networkID));
}

export async function cfxAddressToEthAddress(address: string) {
  return Promise.resolve(
    `0x${toEthAddress(address).hexAddress.toString('hex')}`,
  );
}

const { Transaction } = conflux;

export async function signTransactionWithSigner(
  unsignedTx: IUnsignedTxPro,
  signer: ISigner,
): Promise<ISignedTxPro> {
  const unsignedTransaction = new Transaction(
    unsignedTx.encodedTx as IEncodedTxCfx,
  );
  const digest = keccak256(unsignedTransaction.encode(false));

  const [sig, recoveryParam] = await signer.sign(
    Buffer.from(digest.slice(2), 'hex'),
  );
  const [r, s]: [Buffer, Buffer] = [sig.slice(0, 32), sig.slice(32)];

  const signedTransaction = new Transaction({
    ...(unsignedTx.encodedTx as IEncodedTxCfx),
    r: hexZeroPad(`0x${r.toString('hex')}`, 32),
    s: hexZeroPad(`0x${s.toString('hex')}`, 32),
    v: recoveryParam,
  });

  return {
    digest,
    txid: signedTransaction.hash,
    rawTx: signedTransaction.serialize(),
  };
}
