import {
  crypto_hash as CryptoHash,
  starcoin_types as StarcoinTypes,
  bcs,
  encoding,
  utils,
} from '@starcoin/starcoin';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { Verifier } from '../../base/ChainSigner';
import { CoreChainApiBase } from '../../base/CoreChainApiBase';

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
  IUnsignedTxPro,
} from '../../types';

const curve: ICurveName = 'ed25519';

const pubkeyToAddress = async (
  pub: string,
  encodingType = 'hex',
): Promise<string> => {
  const verifier = new Verifier(pub, 'ed25519');
  let address = '';
  const pubkeyBytes = await verifier.getPubkey();
  if (encodingType === 'hex') {
    address = encoding.publicKeyToAddress(pubkeyBytes.toString('hex'));
  } else if (encodingType === 'bech32') {
    address = encoding.publicKeyToReceiptIdentifier(
      pubkeyBytes.toString('hex'),
    );
  } else {
    throw new Error('invalid encoding');
  }
  return address;
};

const buildUnsignedRawTx = (
  unsignedTx: IUnsignedTxPro,
  chainId: string,
): [StarcoinTypes.RawUserTransaction, Uint8Array] => {
  const fromAddr = unsignedTx?.inputs?.[0].address;
  const { scriptFn, data } = unsignedTx.payload || {};

  const gasLimit = unsignedTx.feeLimit;
  const gasPrice = unsignedTx.feePricePerUnit;
  const { nonce } = unsignedTx;
  const { expirationTime } = unsignedTx.payload || {};

  if (
    !fromAddr ||
    !(scriptFn || data) ||
    !gasLimit ||
    !gasPrice ||
    typeof nonce === 'undefined'
  ) {
    throw new Error('invalid unsignedTx');
  }

  let txPayload: StarcoinTypes.TransactionPayload;
  if (scriptFn) {
    txPayload = scriptFn;
  } else {
    txPayload = encoding.bcsDecode(StarcoinTypes.TransactionPayload, data);
  }

  const rawTxn = utils.tx.generateRawUserTransaction(
    fromAddr,
    txPayload,
    gasLimit.toNumber(),
    gasPrice.toNumber(),
    nonce,
    expirationTime,
    Number(chainId),
  );

  const serializer = new bcs.BcsSerializer();
  rawTxn.serialize(serializer);

  return [rawTxn, serializer.getBytes()];
};

const hashRawTx = (rawUserTransactionBytes: Uint8Array): Uint8Array => {
  const hashSeedBytes = CryptoHash.createRawUserTransactionHasher().get_salt();
  return Uint8Array.of(...hashSeedBytes, ...rawUserTransactionBytes);
};

const buildSignedTx = (
  senderPublicKey: string,
  rawSignature: Buffer,
  rawTxn: StarcoinTypes.RawUserTransaction,
  encodedTx: any,
) => {
  const publicKey = new StarcoinTypes.Ed25519PublicKey(
    Buffer.from(senderPublicKey, 'hex'),
  );
  const signature = new StarcoinTypes.Ed25519Signature(rawSignature);
  const transactionAuthenticatorVariantEd25519 =
    new StarcoinTypes.TransactionAuthenticatorVariantEd25519(
      publicKey,
      signature,
    );
  const signedUserTransaction = new StarcoinTypes.SignedUserTransaction(
    rawTxn,
    transactionAuthenticatorVariantEd25519,
  );
  const se = new bcs.BcsSerializer();
  signedUserTransaction.serialize(se);
  const txid = CryptoHash.createUserTransactionHasher().crypto_hash(
    se.getBytes(),
  );
  const rawTx = hexUtils.hexlify(se.getBytes());

  return { txid, rawTx, encodedTx };
};

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
    const {
      unsignedTx,
      networkInfo: { chainId },
      account,
    } = payload;
    const senderPublicKey = account.pub;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const [rawTxn, rawUserTransactionBytes] = buildUnsignedRawTx(
      unsignedTx,
      chainId,
    );
    const txBytes = hashRawTx(rawUserTransactionBytes);

    const [signature] = await signer.sign(bufferUtils.toBuffer(txBytes));
    return buildSignedTx(
      senderPublicKey as string,
      signature,
      rawTxn,
      unsignedTx.encodedTx,
    );
  }

  override async signMessage(): Promise<string> {
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
    const address = await pubkeyToAddress(publicKey);
    return Promise.resolve({
      address,
      publicKey,
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
