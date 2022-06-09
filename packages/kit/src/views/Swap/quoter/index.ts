import { QuoteParams, Quoter, SwapQuote, TxParams, TxRes } from '../typings';

import { SimpleQuoter } from './0x';
import { SwftcQuoter } from './swftc';

export class SwapQuoter {
  quotors: Quoter[] = [new SimpleQuoter(), new SwftcQuoter()];

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
}
