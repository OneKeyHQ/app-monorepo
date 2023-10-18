/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  isCashAddress,
  isValidAddress,
  toCashAddress,
  toLegacyAddress,
} from 'bchaddrjs';
import { Psbt as PsbtBtcFork } from 'bitcoinforkjs';

import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import type { IBtcForkNetwork } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/provider/networks';

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
} from '../../types';
import type { Psbt } from 'bitcoinjs-lib';

export default class CoreChainSoftware extends CoreChainSoftwareBtc {
  override decodeAddress(address: string): string {
    if (
      !isValidAddress(address) ||
      (isCashAddress(address) && !address.startsWith('bitcoincash:'))
    ) {
      throw new Error(`Invalid address: ${address}`);
    }
    if (isCashAddress(address)) {
      return toLegacyAddress(address);
    }

    return address;
  }

  override encodeAddress(address: string): string {
    if (!isValidAddress(address)) {
      throw new Error(`Invalid address: ${address}`);
    }
    if (!isCashAddress(address)) {
      return toCashAddress(address);
    }
    return address;
  }

  override getPsbt({ network }: { network: IBtcForkNetwork }): Psbt {
    // @ts-expect-error
    return new PsbtBtcFork({ network, forkCoin: 'bch' });
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
