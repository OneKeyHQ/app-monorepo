import { Psbt } from 'bitcoinjs-lib';

import CoreChainSoftwareBtc from '../btc/CoreChainSoftware';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImportedBtc,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHdBtc,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ISignedTxPro,
} from '../../types';
import type { IBtcForkNetwork } from '../btc/types';

export default class CoreChainSoftware extends CoreChainSoftwareBtc {
  override async getCoinName() {
    return Promise.resolve('DOGE');
  }
  override getPsbt({ network }: { network: IBtcForkNetwork }): Psbt {
    return new Psbt({
      network,
      maximumFeeRate: 1000000,
    });
  }

  override signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    return super.signMessage(payload);
  }

  override signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    return super.signTransaction(payload);
  }

  override getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return super.getPrivateKeys(payload);
  }

  override getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImportedBtc,
  ): Promise<ICoreApiGetAddressItem> {
    return super.getAddressFromPrivate(query);
  }

  override getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    return super.getAddressFromPublic(query);
  }

  override getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHdBtc,
  ): Promise<ICoreApiGetAddressesResult> {
    return super.getAddressesFromHd(query);
  }
}
