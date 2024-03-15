import { Psbt as PsbtBtcFork } from 'bitcoinforkjs';

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
import type { Psbt } from 'bitcoinjs-lib';
import * as sdkBch from './sdkBch';

export default class CoreChainSoftware extends CoreChainSoftwareBtc {
  override decodeAddress(address: string): string {
    return sdkBch.decodeAddress(address);
  }

  override encodeAddress(address: string): string {
    return sdkBch.encodeAddress(address);
  }

  override getPsbt({ network }: { network: IBtcForkNetwork }): Psbt {
    // @ts-expect-error
    return new PsbtBtcFork({
      network,
      forkCoin: 'bch',
      maximumFeeRate: 10000,
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
