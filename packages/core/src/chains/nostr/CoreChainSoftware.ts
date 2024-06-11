/* eslint-disable @typescript-eslint/no-unused-vars */

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

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
  type ICoreApiNetworkInfo,
  type ICoreApiPrivateKeysMap,
  type ICoreApiSignBasePayload,
  type ICoreApiSignMsgPayload,
  type ICoreApiSignTxPayload,
  type ICoreCredentialsInfo,
  type ICurveName,
  type ISignedTxPro,
} from '../../types';

import {
  decrypt as decryptNostr,
  encrypt as encryptNostr,
  getNip19EncodedPubkey,
  getPrivateEncodedByNip19,
  signEvent,
  signSchnorr,
} from './sdkNostr';

import type { IEncodedTxNostr } from './types';

const curve: ICurveName = 'secp256k1';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    const {
      // networkInfo,
      // privateKeySource,
      password,
      keyType,
      credentials,
      // xpub,
      // addressEncoding,
    } = query;
    console.log(
      'ExportSecretKeys >>>> nostr',
      this.baseGetCredentialsType({ credentials }),
    );

    const { privateKeyRaw } = await this.baseGetDefaultPrivateKey(query);

    if (!privateKeyRaw) {
      throw new Error('privateKeyRaw is required');
    }
    if (keyType === ECoreApiExportedSecretKeyType.privateKey) {
      const privateKey = decrypt(password, privateKeyRaw);
      const nostrPrivateKey = getPrivateEncodedByNip19(privateKey);
      return nostrPrivateKey;
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
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const prvKey = (await signer.getPrvkey()).toString('hex');
    const { event } = unsignedTx.encodedTx as IEncodedTxNostr;
    const signature = signEvent(event, prvKey);
    event.sig = signature;
    const txid = '';
    const rawTx = JSON.stringify(event);
    return {
      encodedTx: unsignedTx.encodedTx,
      txid,
      rawTx,
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const unsignedMsg = payload.unsignedMsg;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const prvKey = (await signer.getPrvkey()).toString('hex');
    return signSchnorr(prvKey, unsignedMsg.message);
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
    const fixedPublicKey = bufferUtils.toBuffer(publicKey, 'hex').slice(1, 33);
    const fixedPublicKeyHex = bufferUtils.bytesToHex(fixedPublicKey);
    const address = getNip19EncodedPubkey(fixedPublicKeyHex);
    return Promise.resolve({
      address,
      publicKey: fixedPublicKeyHex,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }

  async encrypt(params: {
    networkInfo: ICoreApiNetworkInfo;
    data: {
      pubkey: string;
      plaintext: string;
    };
    account: INetworkAccount;
    password: string;
    credentials: ICoreCredentialsInfo;
  }): Promise<string> {
    const signer = await this.baseGetSingleSigner({
      payload: params,
      curve,
    });
    const prvKey = (await signer.getPrvkey()).toString('hex');
    return encryptNostr(prvKey, params.data.pubkey, params.data.plaintext);
  }

  async decrypt(params: {
    networkInfo: ICoreApiNetworkInfo;
    data: {
      pubkey: string;
      ciphertext: string;
    };
    account: INetworkAccount;
    password: string;
    credentials: ICoreCredentialsInfo;
  }): Promise<string> {
    const signer = await this.baseGetSingleSigner({
      payload: params,
      curve,
    });
    const prvKey = (await signer.getPrvkey()).toString('hex');
    return decryptNostr(prvKey, params.data.pubkey, params.data.ciphertext);
  }
}
