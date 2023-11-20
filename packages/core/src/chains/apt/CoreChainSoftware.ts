import { BCS, TransactionBuilder, TxnBuilderTypes } from 'aptos';
// eslint-disable-next-line camelcase
import { sha3_256 } from 'js-sha3';

import { ed25519 } from '@onekeyhq/core/src/secret';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

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
  IUnsignedMessageAptos,
} from '../../types';

const curveName: ICurveName = 'ed25519';

async function deserializeTransactionAptos(
  rawTx: string,
): Promise<TxnBuilderTypes.RawTransaction> {
  const bytes = bufferUtils.toBuffer(rawTx);
  const deserializer = new BCS.Deserializer(bytes);
  const tx = TxnBuilderTypes.RawTransaction.deserialize(deserializer);
  return Promise.resolve(tx);
}

async function buildSignedTx(
  rawTxn: TxnBuilderTypes.RawTransaction,
  senderPublicKey: string,
  signature: string,
  encodedTx: any,
) {
  const txSignature = new TxnBuilderTypes.Ed25519Signature(
    bufferUtils.hexToBytes(signature),
  );
  const authenticator = new TxnBuilderTypes.TransactionAuthenticatorEd25519(
    new TxnBuilderTypes.Ed25519PublicKey(
      bufferUtils.hexToBytes(hexUtils.stripHexPrefix(senderPublicKey)),
    ),
    txSignature,
  );
  const signRawTx = BCS.bcsToBytes(
    new TxnBuilderTypes.SignedTransaction(rawTxn, authenticator),
  );
  return Promise.resolve({
    txid: '',
    rawTx: bufferUtils.bytesToHex(signRawTx),
    encodedTx,
  });
}

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return this.baseGetPrivateKeys({
      payload,
      curve: curveName,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: curveName,
    });
    const { rawTxUnsigned, encodedTx } = unsignedTx;
    if (!rawTxUnsigned) {
      throw new Error('rawTxUnsigned is undefined');
    }
    const senderPublicKey = unsignedTx.inputs?.[0]?.publicKey;
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }
    const rawTxn = await deserializeTransactionAptos(rawTxUnsigned);
    const signingMessage = TransactionBuilder.getSigningMessage(rawTxn);
    const [signature] = await signer.sign(bufferUtils.toBuffer(signingMessage));
    const signatureHex = hexUtils.hexlify(signature, {
      noPrefix: true,
    });
    return buildSignedTx(rawTxn, senderPublicKey, signatureHex, encodedTx);
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageAptos;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: curveName,
    });
    const { fullMessage } = JSON.parse(unsignedMsg.message);
    const [signature] = await signer.sign(Buffer.from(fullMessage));
    return hexUtils.addHexPrefix(signature.toString('hex'));
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey } = query;
    const pubkey = bufferUtils.toBuffer(publicKey);

    // eslint-disable-next-line camelcase
    const hash = sha3_256.create();
    hash.update(pubkey);
    hash.update('\x00');
    const address = hexUtils.addHexPrefix(hash.hex());
    return Promise.resolve({
      address,
      publicKey,
    });
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const pub = ed25519.publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve: curveName,
    });
  }
}
