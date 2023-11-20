import {
  Ed25519PublicKey,
  IntentScope,
  messageWithIntent,
  toB64,
  toSerializedSignature,
} from '@mysten/sui.js';
import { blake2b } from '@noble/hashes/blake2b';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
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
} from '../../types';

const curve: ICurveName = 'ed25519';

function handleSignData(txnBytes: Uint8Array, isHardware = false) {
  const serializeTxn = messageWithIntent(IntentScope.TransactionData, txnBytes);
  if (isHardware) {
    return serializeTxn;
  }
  return blake2b(serializeTxn, { dkLen: 32 });
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
    const {
      unsignedTx,
      account: { pub },
    } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    if (!unsignedTx.rawTxUnsigned) {
      throw new Error('unsignedTx.rawTxUnsigned is undefined');
    }
    const txnBytes = bufferUtils.toBuffer(unsignedTx.rawTxUnsigned);
    const txBytes = bufferUtils.toBuffer(handleSignData(txnBytes));
    const [signature] = await signer.sign(txBytes);

    const serializeSignature = toSerializedSignature({
      signatureScheme: 'ED25519',
      signature,
      pubKey: new Ed25519PublicKey(bufferUtils.hexToBytes(checkIsDefined(pub))),
    });

    return {
      txid: '',
      rawTx: toB64(txnBytes),
      signatureScheme: 'ed25519',
      signature: serializeSignature,
      publicKey: hexUtils.addHexPrefix(checkIsDefined(pub)),
      encodedTx: unsignedTx.encodedTx,
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    // throw new Error('Method not implemented.');
    // eslint-disable-next-line prefer-destructuring
    const unsignedMsg = payload.unsignedMsg;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const messageScope = messageWithIntent(
      IntentScope.PersonalMessage,
      bufferUtils.hexToBytes(unsignedMsg.message),
    );
    const digest = blake2b(messageScope, { dkLen: 32 });
    const [signature] = await signer.sign(Buffer.from(digest));
    return toSerializedSignature({
      signatureScheme: 'ED25519',
      signature,
      pubKey: new Ed25519PublicKey(
        bufferUtils.hexToBytes(checkIsDefined(payload.account.pub)),
      ),
    });
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
    const { publicKey } = query;
    const pub = new Ed25519PublicKey(bufferUtils.toBuffer(publicKey));
    const address = hexUtils.addHexPrefix(pub.toSuiAddress());
    return Promise.resolve({
      address,
      publicKey,
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
