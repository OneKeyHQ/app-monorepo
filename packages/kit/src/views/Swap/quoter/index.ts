import { Network } from '@onekeyhq/engine/src/types/network';

import { QuoteParams, Quoter, SwapQuote, TxParams, TxRes } from '../typings';

import { SimpleQuoter } from './0x';
import { SwftcQuoter } from './swftc';

export class SwapQuoter {
  static instance = new SwapQuoter();

  swftc = new SwftcQuoter();

  simple = new SimpleQuoter();

  quotors: Quoter[] = [this.simple, this.swftc];

  async getQuote(params: QuoteParams): Promise<SwapQuote | undefined> {
    for (let i = 0; i < this.quotors.length; i += 1) {
      const quotor = this.quotors[i];
      if (quotor.isSupported(params.networkOut, params.networkIn)) {
        const result = await quotor.getQuote(params);
        return result;
      }
    }
  }

  async encodeTx(params: TxParams): Promise<TxRes | undefined> {
    for (let i = 0; i < this.quotors.length; i += 1) {
      const quotor = this.quotors[i];
      if (quotor.isSupported(params.networkOut, params.networkIn)) {
        const result = await quotor.encodeTx(params);
        return result;
      }
    }
  }

  async getBaseInfo() {
    return this.swftc.getBaseInfo();
  }

  async getNoSupportCoins(network: Network, address: string) {
    return this.swftc.getNoSupportCoins(network, address);
  }
}
