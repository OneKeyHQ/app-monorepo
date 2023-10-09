/* eslint-disable @typescript-eslint/no-unused-vars */

import { getUtxoAccountPrefixPath } from '@onekeyhq/engine/src/managers/derivation';
import type { ICurveName } from '@onekeyhq/engine/src/secret';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import { signEncodedTx } from './sdkNexa';

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
} from '../../types';

const curve: ICurveName = 'secp256k1';
const firstAddressRelPath = '0/0';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    if (payload.credentials.hd) {
      payload.account.relPaths = payload.account.relPaths || [
        // NEXA use single address mode of utxo,
        //    so we should set first address relPaths
        firstAddressRelPath,
      ];
    }
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
    const result = await signEncodedTx(
      unsignedTx,
      signer,
      unsignedTx.payload.address,
    );
    return result;
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
    const { publicKey, networkInfo, publicKeyInfo } = query;
    const address = publicKey;

    const fullPath = publicKeyInfo?.path || '';

    const prefixPath = getUtxoAccountPrefixPath({
      fullPath,
    });

    const path = fullPath ? prefixPath : '';

    return Promise.resolve({
      address,
      publicKey,
      xpub: '',
      path,
      addresses: { [networkInfo.networkId]: publicKey },
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
