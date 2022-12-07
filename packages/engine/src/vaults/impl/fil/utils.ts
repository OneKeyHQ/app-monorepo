import { FilecoinSigner } from '@blitslabs/filecoin-js-signer';
import {
  SignedTx,
  TransactionStatus,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';

import { Signer } from '../../../proxy';
import { IDecodedTxStatus, IUnsignedTxPro } from '../../types';

import { IEncodedTxFil, ProtocolIndicator } from './types';

export async function signTransaction(
  unsignedTx: IUnsignedTxPro,
  signer: Signer,
): Promise<SignedTx> {
  const tool = new FilecoinSigner();
  const encodedTx = unsignedTx.encodedTx as IEncodedTxFil;
  const unsignedMessage = {
    ...encodedTx,
    Value: new BigNumber(encodedTx.Value),
    GasFeeCap: new BigNumber(encodedTx.GasFeeCap),
    GasPremium: new BigNumber(encodedTx.GasPremium),
  };
  const message = tool.tx.transactionSerializeRaw(unsignedMessage);

  const messageDigest = tool.utils.getDigest(message);
  const [sig, recoveryParam] = await signer.sign(messageDigest);

  const signatureResult = Buffer.concat([
    Buffer.from(sig),
    Buffer.from([recoveryParam]),
  ]);

  return Promise.resolve({
    txid: '',
    rawTx: JSON.stringify({
      Message: encodedTx,
      Signature: {
        Data: signatureResult.toString('base64'),
        Type: ProtocolIndicator.SECP256K1,
      },
    }),
  });
}

export function getTxStatus(status: number | null | undefined) {
  switch (status) {
    case 0:
      return TransactionStatus.CONFIRM_AND_SUCCESS;
    case 1:
      return TransactionStatus.CONFIRM_BUT_FAILED;
    case 2:
    case null:
      return TransactionStatus.INVALID;
    default:
      return TransactionStatus.PENDING;
  }
}

export function getDecodedTxStatus(status: number | null | undefined) {
  switch (status) {
    case 0:
      return IDecodedTxStatus.Confirmed;
    case 1:
      return IDecodedTxStatus.Failed;
    case 2:
    case null:
      return IDecodedTxStatus.Dropped;
    default:
      return IDecodedTxStatus.Pending;
  }
}
