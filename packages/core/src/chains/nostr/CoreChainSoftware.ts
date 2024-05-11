/* eslint-disable @typescript-eslint/no-unused-vars */

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import {
  decrypt,
  encrypt,
  getNip19EncodedPubkey,
  signEvent,
  signSchnorr,
} from './sdkNostr';

import type { IEncodedTxNostr } from './types';
import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiNetworkInfo,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ICoreCredentialsInfo,
  ICurveName,
  ISignedTxPro,
} from '../../types';

const curve: ICurveName = 'secp256k1';

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
    return encrypt(prvKey, params.data.pubkey, params.data.plaintext);
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
    return decrypt(prvKey, params.data.pubkey, params.data.ciphertext);
  }
}
