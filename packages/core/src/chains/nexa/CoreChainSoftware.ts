import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { getUtxoAccountPrefixPath } from '../../utils';

import { getDisplayAddress, signEncodedTx } from './sdkNexa';

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
      // @ts-expect-error
      unsignedTx.payload.address,
    );
    return result;
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
    const { publicKey, networkInfo, publicKeyInfo } = query;
    const address = publicKey;

    const fullPath = publicKeyInfo?.path || '';

    const prefixPath = getUtxoAccountPrefixPath({
      fullPath,
    });

    const path = fullPath ? prefixPath : '';

    const displayAddress = getDisplayAddress({
      address,
      chainId: networkInfo.chainId,
    });

    return Promise.resolve({
      address,
      publicKey,
      xpub: '',
      path,
      addresses: { [networkInfo.networkId]: displayAddress },
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
