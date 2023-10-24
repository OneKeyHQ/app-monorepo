/* eslint-disable @typescript-eslint/no-unused-vars */

import BN from 'bn.js';
import { baseDecode, baseEncode } from 'borsh';
import bs58 from 'bs58';
import sha256 from 'js-sha256';
import { isString } from 'lodash';
import { transactions, utils } from 'near-api-js';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import type { IEncodedTxNear, INativeTxNear } from './types';
import type { ISigner } from '../../base/ChainSigner';
import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ICurveName,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';
import type {
  SignedTransaction,
  Transaction,
} from 'near-api-js/lib/transaction';

const curve: ICurveName = 'ed25519';

function serializeTransaction(
  transaction: Transaction | SignedTransaction | string,
  {
    encoding = 'base64',
  }: {
    encoding?: 'sha256_bs58' | 'base64';
  } = {},
): string {
  if (isString(transaction)) {
    return transaction;
  }
  const message = transaction.encode();

  // **** encoding=sha256_bs58 only for sign, can not deserialize
  if (encoding === 'sha256_bs58') {
    // always return txHash, as txHash is serializable to background, but not message
    const txHash = new Uint8Array(sha256.sha256.array(message));
    // same to txid in NEAR
    return bs58.encode(txHash);
  }

  // **** encoding=base64 for dapp sign, can deserialize
  // const hash = new Uint8Array(sha256.sha256.array(message));
  if (
    typeof Buffer !== 'undefined' &&
    Buffer.from &&
    typeof Buffer.from === 'function'
  ) {
    return Buffer.from(message).toString('base64');
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return message.toString('base64');
}

function deserializeTransaction(txStr: string): Transaction {
  /*
const deserializeTransactionsFromString = (transactionsString) => transactionsString.split(',')
  .map(str => Buffer.from(str, 'base64'))
  .map(buffer => utils.serialize.deserialize(transaction.SCHEMA, transaction.Transaction, buffer));
*/
  const buffer = Buffer.from(txStr, 'base64');
  const tx = utils.serialize.deserialize(
    transactions.SCHEMA,
    transactions.Transaction,
    buffer,
  );
  return tx;
}

async function parseToNativeTx(
  encodedTx: IEncodedTxNear,
): Promise<INativeTxNear | null> {
  if (!encodedTx) {
    return Promise.resolve(null);
  }
  return Promise.resolve(deserializeTransaction(encodedTx));
}

async function signTransaction(
  unsignedTx: IUnsignedTxPro,
  signer: ISigner,
): Promise<ISignedTxPro> {
  const encodedTx = unsignedTx.encodedTx as IEncodedTxNear;
  const transaction = await parseToNativeTx(encodedTx);
  if (!transaction) {
    throw new Error('nativeTx is null');
  }
  const { nonce, blockHash } = unsignedTx.payload as {
    nonce: number;
    blockHash: string;
  };
  checkIsDefined(nonce);
  checkIsDefined(blockHash);
  transaction.nonce = new BN(nonce);
  transaction.blockHash = baseDecode(blockHash);

  const txHash: string = serializeTransaction(transaction, {
    encoding: 'sha256_bs58',
  });
  const digest = baseDecode(txHash);
  const res = await signer.sign(digest);
  const signature = new Uint8Array(res[0]);

  const signedTx = new transactions.SignedTransaction({
    transaction,
    signature: new transactions.Signature({
      keyType: transaction.publicKey.keyType,
      data: signature,
    }),
  });
  const rawTx = serializeTransaction(signedTx);

  const publicKey = await signer.getPubkey(true);

  return {
    txid: txHash,
    rawTx,
    digest: Buffer.from(digest).toString('hex'),
    signature: Buffer.from(signature).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
    encodedTx: unsignedTx.encodedTx,
  };
}

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    // throw new Error('Method not implemented.');
    return this.baseGetPrivateKeys({
      payload,
      curve,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    // throw new Error('Method not implemented.');
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    return signTransaction(unsignedTx, signer);
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    // throw new Error('Method not implemented.');
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
    // throw new Error('Method not implemented.');
    const { publicKey } = query;
    const publicKeyBuffer = bufferUtils.toBuffer(publicKey);
    const address = publicKey;
    const pub = `ed25519:${baseEncode(publicKeyBuffer)}`;
    return Promise.resolve({
      address,
      publicKey: pub,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    // throw new Error('Method not implemented.');
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }
}
