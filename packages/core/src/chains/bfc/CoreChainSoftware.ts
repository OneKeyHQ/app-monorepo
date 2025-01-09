import {
  IntentScope,
  messageWithIntent,
  toSerializedSignature,
} from '@benfen/bfc.js/cryptography';
import {
  Ed25519Keypair,
  Ed25519PublicKey,
} from '@benfen/bfc.js/keypairs/ed25519';
import { hex2BfcAddress, toB64 } from '@benfen/bfc.js/utils';
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

export function handleSignData(txnBytes: Uint8Array) {
  const serializeTxn = messageWithIntent(IntentScope.TransactionData, txnBytes);
  return serializeTxn;
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
      'ExportSecretKeys >>>> bfc',
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

    const prvKey = await signer.getPrvkey();
    const keypair = Ed25519Keypair.fromSecretKey(prvKey);
    const txnBytes = bufferUtils.toBuffer(unsignedTx.rawTxUnsigned);
    const intentMessage = handleSignData(txnBytes);
    const digest = blake2b(intentMessage, { dkLen: 32 });
    const pubkey = keypair.getPublicKey();
    const signature = keypair.signData(digest);
    const signatureScheme = keypair.getKeyScheme();
    const serializeSignature = toSerializedSignature({
      signature,
      signatureScheme,
      publicKey: pubkey,
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
    const unsignedMsg = payload.unsignedMsg;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const prvKey = await signer.getPrvkey();
    const keypair = Ed25519Keypair.fromSecretKey(prvKey);
    const messageBytes = bufferUtils.toBuffer(unsignedMsg.message);
    const signature = await keypair.signPersonalMessage(messageBytes);
    return signature.signature;
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
    const hexAddress = pub.toHexAddress();
    const address = hex2BfcAddress(hexAddress);
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
