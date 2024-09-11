/* eslint-disable @typescript-eslint/no-unused-vars */

import { NotImplemented } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiGetExportedSecretKey,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ICurveName,
  ISignedTxPro,
} from '../../types';

const curve: ICurveName = 'ed25519';

export default class CoreChainSoftware extends CoreChainApiBase {
  override getExportedSecretKey(
    query: ICoreApiGetExportedSecretKey,
  ): Promise<string> {
    throw new NotImplemented();
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    throw new NotImplemented();
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    throw new NotImplemented();
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    throw new NotImplemented();
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    throw new NotImplemented();
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    throw new NotImplemented();
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return Promise.resolve({
      addresses: [
        {
          address: '',
          publicKey: '',
          path: accountUtils.buildPathFromTemplate({
            template: query.template,
            index: query.indexes[0],
          }),
        },
      ],
    });
  }
}
