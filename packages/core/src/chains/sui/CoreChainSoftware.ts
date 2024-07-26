import {
  Ed25519PublicKey,
  IntentScope,
  bcs,
  messageWithIntent,
  toB64,
  toSerializedSignature,
} from '@mysten/sui.js';
import { blake2b } from '@noble/hashes/blake2b';

import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { decrypt } from '../../secret';
import {
  ECoreApiExportedSecretKeyType,
  type ICoreApiGetAddressItem,
  type ICoreApiGetAddressQueryImported,
  type ICoreApiGetAddressQueryPublicKey,
  type ICoreApiGetAddressesQueryHd,
  type ICoreApiGetAddressesResult,
  type ICoreApiGetExportedSecretKey,
  type ICoreApiPrivateKeysMap,
  type ICoreApiSignBasePayload,
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICurveName,
  type ISignedTxPro,
} from '../../types';

const curve: ICurveName = 'ed25519';

export function handleSignData(txnBytes: Uint8Array, isHardware = false) {
  const serializeTxn = messageWithIntent(IntentScope.TransactionData, txnBytes);
  if (isHardware) {
    return serializeTxn;
  }
  return blake2b(serializeTxn, { dkLen: 32 });
}

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      // networkInfo,

      password,
      keyType,
      credentials,
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> sui',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new Error('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      return `0x${decrypt(password, privateKeyRaw).toString('hex')}`;
    }
    throw new Error(`SecretKey type not support: ${keyType}`);
  }

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
    // throw new NotImplemented();;
    // eslint-disable-next-line prefer-destructuring
    const unsignedMsg = payload.unsignedMsg;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const messageScope = messageWithIntent(
      IntentScope.PersonalMessage,
      bcs
        .ser(['vector', 'u8'], bufferUtils.hexToBytes(unsignedMsg.message))
        .toBytes(),
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
    // throw new NotImplemented();;
    const { privateKeyRaw } = query;

    let privateKey: Buffer | undefined;
    if (hexUtils.isHexString(privateKeyRaw)) {
      privateKey = bufferUtils.toBuffer(privateKeyRaw, 'hex');
    } else {
      // eslint-disable-next-line spellcheck/spell-checker
      // suiprivkey1qq*****
      // privateKey = bufferUtils.toBuffer(privateKeyRaw, 'utf-8'); // not correct buffer convert for sui
    }

    if (!privateKey) {
      throw new Error('Invalid private key');
    }

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
