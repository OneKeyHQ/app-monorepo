import { hexZeroPad } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { Transaction, address as confluxAddress } from 'js-conflux-sdk';
import Contract from 'js-conflux-sdk/dist/types/contract';

import { Signer } from '../../../proxy';
import { IDecodedTxActionType, ISignedTx, IUnsignedTxPro } from '../../types';

import { IEncodedTxCfx, ITxDescCfx } from './types';

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

export function parseTransaction(
  encodedTx: IEncodedTxCfx,
  crc20Interface: Contract,
): [IDecodedTxActionType, ITxDescCfx | null] {
  if (isCfxNativeTransferType({ data: encodedTx.data, to: encodedTx.to })) {
    return [IDecodedTxActionType.NATIVE_TRANSFER, null];
  }

  try {
    let txType = IDecodedTxActionType.UNKNOWN;
    const txDesc = crc20Interface.abi.decodeData(encodedTx.data);
    if (txDesc) {
      switch (txDesc.name) {
        case 'transfer': {
          txType = IDecodedTxActionType.TOKEN_TRANSFER;
          break;
        }
        case 'transferFrom': {
          txType = IDecodedTxActionType.TOKEN_TRANSFER;
          break;
        }
        case 'approve': {
          txType = IDecodedTxActionType.TOKEN_APPROVE;
          break;
        }
        default: {
          txType = IDecodedTxActionType.FUNCTION_CALL;
        }
      }
    }
    return [txType, txDesc];
  } catch (error) {
    return [IDecodedTxActionType.UNKNOWN, null];
  }
}
