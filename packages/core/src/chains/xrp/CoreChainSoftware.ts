import BigNumber from 'bignumber.js';
import { sign } from 'ripple-keypairs';
import { deriveAddress, encode, encodeForSigning, hashes } from 'xrpl';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import type { IEncodedTxXrp } from './types';
import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignTxPayload,
  ICurveName,
  ISignedTxPro,
} from '../../types';
import type { Transaction } from 'xrpl';
import { NotImplemented } from '@onekeyhq/shared/src/errors';

const curve: ICurveName = 'secp256k1';

function removeTrailingZeros(tx: Transaction): void {
  if (
    tx.TransactionType === 'Payment' &&
    typeof tx.Amount !== 'string' &&
    tx.Amount.value.includes('.') &&
    tx.Amount.value.endsWith('0')
  ) {
    // eslint-disable-next-line no-param-reassign -- Required to update Transaction.Amount.value
    tx.Amount = { ...tx.Amount };
    // eslint-disable-next-line no-param-reassign -- Required to update Transaction.Amount.value
    tx.Amount.value = new BigNumber(tx.Amount.value).toString();
  }
}

function computeSignature(tx: Transaction, privateKey: string): string {
  return sign(encodeForSigning(tx), privateKey);
}

function signature(
  transaction: Transaction,
  publicKey: string,
  privateKey: string,
) {
  const tx = { ...transaction };

  if (tx.TxnSignature || tx.Signers) {
    throw new Error(
      'txJSON must not contain "TxnSignature" or "Signers" properties',
    );
  }

  removeTrailingZeros(tx);

  const txToSignAndEncode = { ...tx };

  txToSignAndEncode.SigningPubKey = publicKey;
  txToSignAndEncode.TxnSignature = computeSignature(
    txToSignAndEncode,
    privateKey,
  );

  const serialized = encode(txToSignAndEncode);

  return {
    tx_blob: serialized,
    hash: hashes.hashSignedTx(serialized),
  };
}

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    // throw new NotImplemented();;
    return this.baseGetPrivateKeys({
      payload,
      curve,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    // throw new NotImplemented();;
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const prvKey = (await signer.getPrvkey()).toString('hex').toUpperCase();
    const pub = (await signer.getPubkey(true)).toString('hex').toUpperCase();
    // eslint-disable-next-line prefer-destructuring
    const encodedTx = unsignedTx.encodedTx;
    // const txBytes = bufferUtils.toBuffer('');
    const signResult = signature(
      encodedTx as IEncodedTxXrp,
      pub,
      `00${prvKey}`,
    );

    const txid = signResult.hash;
    const rawTx = signResult.tx_blob;
    return {
      encodedTx: unsignedTx.encodedTx,
      txid,
      rawTx,
    };
  }

  override async signMessage(): Promise<string> {
    throw new NotImplemented();;
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    const pub = this.baseGetCurve(curve).publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey } = query;
    const pub = publicKey.toUpperCase();
    const address = deriveAddress(pub);

    return Promise.resolve({
      address,
      publicKey: pub,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }
}
