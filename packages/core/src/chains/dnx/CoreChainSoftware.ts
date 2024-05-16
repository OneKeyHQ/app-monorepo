/* eslint-disable @typescript-eslint/no-unused-vars */

import { NotImplemented } from '@onekeyhq/shared/src/errors';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignTxPayload,
  ISignedTxPro,
} from '../../types';

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getPrivateKeys(): Promise<ICoreApiPrivateKeysMap> {
    throw new NotImplemented('Method not implemented.');
  }

  override async signTransaction(): Promise<ISignedTxPro> {
    throw new NotImplemented('Method not implemented.');
  }

  override async signMessage(): Promise<string> {
    throw new NotImplemented('Method not implemented.');
  }

  override async getAddressFromPrivate(): Promise<ICoreApiGetAddressItem> {
    throw new NotImplemented('Method not implemented.');
  }

  override async getAddressFromPublic(): Promise<ICoreApiGetAddressItem> {
    throw new NotImplemented('Method not implemented.');
  }

  override async getAddressesFromHd(): Promise<ICoreApiGetAddressesResult> {
    throw new NotImplemented('Method not implemented.');
  }
}
