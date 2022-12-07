import { FilecoinSigner } from '@blitslabs/filecoin-js-signer';
import { SignedTx } from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';

import { Signer } from '../../../proxy';
import { IUnsignedTxPro } from '../../types';

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
