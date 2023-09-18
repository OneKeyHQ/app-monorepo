/* eslint-disable @typescript-eslint/no-unused-vars */

import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';

import { CoreChainApiBase } from '../_base/CoreChainApiBase';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
} from '../../types';

export default class CoreChainSoftware extends CoreChainApiBase {
  override getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    throw new Error('Method not implemented.');
  }

  override signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override signMessage(query: ICoreApiSignMsgPayload): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    throw new Error('Method not implemented.');
  }

  override getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    throw new Error('Method not implemented.');
  }
}
