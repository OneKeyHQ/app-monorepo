import * as bchaddrjs from 'bchaddrjs';
import * as BitcoinForkJS from 'bitcoinforkjs';

import { Provider as BaseProvider } from '../../utils/btcForkChain/provider';

import type { Psbt } from 'bitcoinjs-lib';

export default class Provider extends BaseProvider {
  override decodeAddress(address: string): string {
    if (
      !bchaddrjs.isValidAddress(address) ||
      (bchaddrjs.isCashAddress(address) && !address.startsWith('bitcoincash:'))
    ) {
      throw new Error(`Invalid address: ${address}`);
    }
    if (bchaddrjs.isCashAddress(address)) {
      return bchaddrjs.toLegacyAddress(address);
    }

    return address;
  }

  override encodeAddress(address: string): string {
    if (!bchaddrjs.isValidAddress(address)) {
      throw new Error(`Invalid address: ${address}`);
    }
    if (!bchaddrjs.isCashAddress(address)) {
      return bchaddrjs.toCashAddress(address);
    }
    return address;
  }

  override getPsbt(): Psbt {
    // @ts-expect-error
    return new BitcoinForkJS.Psbt({
      network: this.network,
      forkCoin: 'bch',
      maximumFeeRate: 10000,
    });
  }
}
