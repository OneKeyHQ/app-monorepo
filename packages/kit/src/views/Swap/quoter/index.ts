import { Network } from '@onekeyhq/engine/src/types/network';

import {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  QuoteData,
  Quoter,
  QuoterType,
  TransactionDetails,
  TransactionStatus,
} from '../typings';

import { SimpleQuoter } from './0x';
import { MdexQuoter } from './mdex';
import { SocketQuoter } from './socket';
import { SwftcQuoter } from './swftc';

export class SwapQuoter {
  static client = new SwapQuoter();

  swftc = new SwftcQuoter();

  simple = new SimpleQuoter();

  sockets = new SocketQuoter();

  mdex = new MdexQuoter();

  quotors: Quoter[] = [this.mdex, this.simple, this.swftc];

  prepare() {
    this.quotors.forEach((quotor) => {
      quotor.prepare?.();
    });
  }

  async fetchQuote(params: FetchQuoteParams): Promise<QuoteData | undefined> {
    for (let i = 0; i < this.quotors.length; i += 1) {
      const current = this.quotors[i];
      if (current.isSupported(params.networkOut, params.networkIn)) {
        const result = await current.fetchQuote(params);
        if (result) {
          return result;
        }
      }
    }
  }

  async buildTransaction(
    quoterType: QuoterType,
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    for (let i = 0; i < this.quotors.length; i += 1) {
      const current = this.quotors[i];
      if (
        current.type === quoterType &&
        current.isSupported(params.networkOut, params.networkIn)
      ) {
        const result = await current.buildTransaction(params);
        if (result) {
          return result;
        }
      }
    }
  }

  getQuoteType(tx: TransactionDetails): QuoterType {
    if (tx.quoterType) {
      return tx.quoterType;
    }
    if (tx.thirdPartyOrderId) {
      return 'swftc';
    }
    return '0x';
  }

  async queryTransactionStatus(
    tx: TransactionDetails,
  ): Promise<TransactionStatus | undefined> {
    const quoterType = this.getQuoteType(tx);
    for (let i = 0; i < this.quotors.length; i += 1) {
      const current = this.quotors[i];
      if (current.type === quoterType) {
        return current.queryTransactionStatus(tx);
      }
    }
    return undefined;
  }

  async getSwftcSupportedTokens() {
    return this.swftc.getGroupedCoins();
  }

  async getNoSupportCoins(network: Network, address: string) {
    return this.swftc.getNoSupportCoins(network, address);
  }
}
