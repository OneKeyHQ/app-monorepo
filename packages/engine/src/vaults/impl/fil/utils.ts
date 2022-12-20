import { FilecoinSigner } from '@blitslabs/filecoin-js-signer';
import { TransactionStatus } from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';

import { IDecodedTxStatus } from '../../types';

import { ProtocolIndicator } from './types';

import type { Signer } from '../../../proxy';
import type { IUnsignedTxPro } from '../../types';
import type { IEncodedTxFil } from './types';
import type { SignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';

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

export function getTxStatus(
  status: number | null | undefined,
  cid: string | undefined,
) {
  if (status !== 0 && status !== -1) {
    return TransactionStatus.CONFIRM_BUT_FAILED;
  }

  if (cid && status === 0) {
    return TransactionStatus.CONFIRM_AND_SUCCESS;
  }

  return TransactionStatus.PENDING;
}

export function getDecodedTxStatus(
  status: number | null | undefined,
  cid: string | undefined,
) {
  if (status !== 0 && status !== -1) {
    return IDecodedTxStatus.Failed;
  }

  if (cid && status === 0) {
    return IDecodedTxStatus.Confirmed;
  }

  return IDecodedTxStatus.Pending;
}
