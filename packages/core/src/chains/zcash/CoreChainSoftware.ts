import { Psbt } from 'bitcoinjs-lib';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import CoreChainSoftwareBtc from '../btc/CoreChainSoftware';

import * as sdkZcash from './sdkZcash';

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

// Transparent address derivation reuses the BTC pipeline; the 2-byte t-address
// prefix is bridged in encode/decodeAddress. Signing never takes the BTC path:
// Zcash uses ZIP-244 sighashes, produced by the keys WASM.
export default class CoreChainSoftware extends CoreChainSoftwareBtc {
  override async getCoinName() {
    return Promise.resolve('ZEC');
  }

  override async getXpubRegex() {
    return '^([x]pub)';
  }

  override async getXprvtRegex() {
    return '^([x]prv)';
  }

  override decodeAddress(address: string): string {
    return sdkZcash.decodeAddress(address);
  }

  override encodeAddress(address: string): string {
    return sdkZcash.encodeAddress(address);
  }

  override getPsbt({ network }: { network: IBtcForkNetwork }): Psbt {
    return new Psbt({
      network,
      maximumFeeRate: network.maximumFeeRate,
    });
  }

  override signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    return super.signMessage(payload);
  }

  override signTransaction(
    _payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    return Promise.reject(
      new OneKeyLocalError(
        'Zcash transaction signing is handled by the PCZT signer, not the BTC path',
      ),
    );
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
