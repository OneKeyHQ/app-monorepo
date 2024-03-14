import * as BitcoinJS from 'bitcoinjs-lib';

import { Provider as BaseProvider } from '../../utils/btcForkChain/provider';

import type { Psbt } from 'bitcoinjs-lib';

export default class Provider extends BaseProvider {
  override getPsbt(): Psbt {
    return new BitcoinJS.Psbt({
      network: this.network,
      maximumFeeRate: 1000000,
    });
  }
}
