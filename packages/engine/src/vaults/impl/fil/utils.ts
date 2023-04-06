import { FilecoinSigner } from '@blitslabs/filecoin-js-signer';
import BigNumber from 'bignumber.js';

import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type { SignedTx } from '@onekeyhq/engine/src/types/provider';

import { IDecodedTxStatus } from '../../types';

import { ProtocolIndicator } from './types';

import type { Signer } from '../../../proxy';
import type { IUnsignedTxPro } from '../../types';
import type { IEncodedTxFil } from './types';

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
  status: string | null | undefined,
  cid: string | undefined,
) {
  if (cid && status === 'OK') {
    return TransactionStatus.CONFIRM_AND_SUCCESS;
  }

  if (status?.toLowerCase().includes('err')) {
    return TransactionStatus.CONFIRM_BUT_FAILED;
  }

  return TransactionStatus.PENDING;
}

export function getDecodedTxStatus(
  status: string | null | undefined,
  cid: string | undefined,
) {
  if (cid && status === 'OK') {
    return IDecodedTxStatus.Confirmed;
  }

  if (status?.toLowerCase().includes('err')) {
    return IDecodedTxStatus.Failed;
  }

  return IDecodedTxStatus.Pending;
}
