import { Network } from '@onekeyhq/engine/src/types/network';

import {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  FetchQuoteResponse,
  Quoter,
  QuoterType,
  TransactionDetails,
  TransactionProgress,
} from '../typings';

import { SimpleQuoter } from './0x';
import { MdexQuoter } from './mdex';
import { SocketQuoter } from './socket';
import { SwftcQuoter } from './swftc';

export class SwapQuoter {
  static client = new SwapQuoter();

  swftc = new SwftcQuoter();

  simple = new SimpleQuoter();

  socket = new SocketQuoter();

  mdex = new MdexQuoter();

  quoters: Quoter[] = [this.mdex, this.simple, this.socket, this.swftc];

  prepare() {
    this.quoters.forEach((quoter) => {
      quoter.prepare?.();
    });
  }

  async fetchQuote(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    for (let i = 0; i < this.quoters.length; i += 1) {
      const quoter = this.quoters[i];
      if (quoter.isSupported(params.networkOut, params.networkIn)) {
        const result = await quoter.fetchQuote(params);
        if (result?.data) {
          return result;
        }
      }
    }
  }

  async buildTransaction(
    quoterType: QuoterType,
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    for (let i = 0; i < this.quoters.length; i += 1) {
      const quoter = this.quoters[i];
      if (
        quoter.type === quoterType &&
        quoter.isSupported(params.networkOut, params.networkIn)
      ) {
        const result = await quoter.buildTransaction(params);
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
      return QuoterType.swftc;
    }
    return QuoterType.zeroX;
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const quoterType = this.getQuoteType(tx);
    for (let i = 0; i < this.quoters.length; i += 1) {
      const quoter = this.quoters[i];
      if (quoter.type === quoterType) {
        return quoter.queryTransactionProgress(tx);
      }
    }
    return undefined;
  }

  async getSupportedTokens() {
    return this.swftc.getGroupedCoins();
  }

  async getNoSupportCoins(network: Network, address: string) {
    return this.swftc.getNoSupportCoins(network, address);
  }
}
