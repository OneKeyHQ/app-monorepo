import { hexZeroPad } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { Transaction, address as confluxAddress } from 'js-conflux-sdk';

import { Signer } from '../../../proxy';
import { ISignedTx, IUnsignedTxPro } from '../../types';

import { IEncodedTxCfx } from './types';

export function isCfxNativeTransferType(options: { data: string; to: string }) {
  const { data, to } = options;
  const hexCfxAddress = confluxAddress.isValidHexAddress(to)
    ? to
    : `0x${confluxAddress.decodeCfxAddress(to).hexAddress.toString('hex')}`;
  if (confluxAddress.isInternalContractAddress(hexCfxAddress)) return false;
  return !data || data === '0x' || data === '0x0' || data === '0';
}

export async function signTransaction(
  unsignedTx: IUnsignedTxPro,
  signer: Signer,
): Promise<ISignedTx> {
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
    txid: signedTransaction.hash,
    rawTx: signedTransaction.serialize(),
    encodedTx: unsignedTx.encodedTx,
  };
}
