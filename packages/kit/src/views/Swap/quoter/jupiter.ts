import axios from 'axios';
import BigNumber from 'bignumber.js';

import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token } from '@onekeyhq/engine/src/types/token';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { QuoterType } from '../typings';
import { calculateRate, div, getTokenAmountString } from '../utils';

import type {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  FetchQuoteResponse,
  QuoteData,
  Quoter,
  TransactionDetails,
  TransactionProgress,
} from '../typings';
import type { Axios } from 'axios';

type PriceInfo = {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
};

type JupiterQuoteParams = {
  inputMint: string;
  outputMint: string;
  amount: string;
  swapMode: string;
  slippage: string;
  onlyDirectRoutes: boolean;
};

type JupiterRoute = {
  inAmount: number;
  outAmount: number;
  amount: number;
  otherAmountThreshold: number;
  outAmountWithSlippage: number;
  swapMode: string;
  priceImpactPct: number;
  marketInfos: MarketInfo[];
};

type MarketInfo = {
  id: string;
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  lpFee: {
    amount: string;
    mint: string;
    pct: string;
  };
  platformFee: {
    amount: string;
    mint: string;
    pct: string;
  };
  notEnoughLiquidity: boolean;
  priceImpactPct: number;
};

type JupiterTransactions = {
  setupTransaction?: string;
  swapTransaction: string;
  cleanupTransaction?: string;
};

function getSolanaTokenMint(token: Token) {
  return token.tokenIdOnNetwork
    ? token.tokenIdOnNetwork
    : 'So11111111111111111111111111111111111111112';
}

export class JupiterQuoter implements Quoter {
  private client: Axios;

  type: QuoterType = QuoterType.jupiter;

  constructor() {
    this.client = axios.create({ timeout: 60 * 1000 });
  }

  async getBaseURL(): Promise<string> {
    const baseUrl = await backgroundApiProxy.serviceSwap.getServerEndPoint();
    return `${baseUrl}/jupiter`;
  }

  isSupported(networkA: Network, networkB: Network): boolean {
    return networkA.id === networkB.id && networkA.impl === 'sol';
  }

  private async fetchPrice(tokenIn: Token, tokenOut: Token) {
    const baseUrl = await this.getBaseURL();
    const url = `${baseUrl}/v1/price`;
    const res = await this.client.get(url, {
      params: {
        id: getSolanaTokenMint(tokenIn),
        vsToken: getSolanaTokenMint(tokenOut),
      },
    });
    if (!res.data) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const priceInfo = res.data.data as PriceInfo;
    return priceInfo;
  }

  private async buildSwapTransaction(
    route: JupiterRoute,
    address: string,
    outputMint: string,
  ): Promise<string | undefined> {
    const baseUrl = await this.getBaseURL();
    const url = `${baseUrl}/v1/swap`;
    const res = await this.client.post(url, {
      route,
      userPublicKey: address,
      outputMint,
    });
    const transactions = res.data as JupiterTransactions | undefined;
    if (transactions?.cleanupTransaction || transactions?.setupTransaction) {
      return undefined;
    }
    return transactions?.swapTransaction;
  }

  private async findBestTransaction(
    routes: JupiterRoute[],
    address: string,
    outputMint: string,
  ): Promise<{ route: JupiterRoute; transaction: string } | undefined> {
    for (let i = 0; i < routes.length; i += 1) {
      const route = routes[i];
      const transaction = await this.buildSwapTransaction(
        route,
        address,
        outputMint,
      );
      if (transaction) {
        return { transaction, route };
      }
    }
  }

  private async doQuote(
    params: JupiterQuoteParams,
    address: string,
  ): Promise<
    | undefined
    | { route: JupiterRoute; transaction: string; percentageFee?: string }
  > {
    const baseUrl = await this.getBaseURL();
    const url = `${baseUrl}/v1/quote`;
    const res = await this.client.get(url, {
      params,
    });

    if (!res.data) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const routes = res.data.data as JupiterRoute[];
    const routeTransaction = await this.findBestTransaction(
      routes,
      address,
      params.outputMint,
    );
    if (!routeTransaction) {
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return { ...routeTransaction, percentageFee: res?.data?.percentageFee };
  }

  private async refreshRecentBlockBash(accountId: string, transaction: string) {
    return backgroundApiProxy.engine.solanaRefreshRecentBlockBash({
      transaction,
      accountId,
      networkId: OnekeyNetwork.sol,
    });
  }

  private async findRouteAndTransaction(
    params: FetchQuoteParams,
  ): Promise<
    | undefined
    | { route: JupiterRoute; transaction: string; percentageFee?: string }
  > {
    const { tokenIn, tokenOut, typedValue, independentField, activeAccount } =
      params;
    const baseParams = {
      inputMint: getSolanaTokenMint(tokenIn),
      outputMint: getSolanaTokenMint(tokenOut),
      amount: getTokenAmountString(
        independentField === 'OUTPUT' ? tokenOut : tokenIn,
        typedValue,
      ),
      swapMode: 'ExactIn',
      slippage: params.slippagePercentage,
      onlyDirectRoutes: true,
    };
    if (independentField === 'OUTPUT') {
      baseParams.swapMode = 'ExactOut';
    }

    const directRouteTransaction = await this.doQuote(
      baseParams,
      activeAccount.address,
    );

    if (directRouteTransaction) {
      return directRouteTransaction;
    }

    baseParams.onlyDirectRoutes = false;

    const indirectRouteTransaction = await this.doQuote(
      baseParams,
      activeAccount.address,
    );

    return indirectRouteTransaction;
  }

  async fetchRawQuote(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    const { tokenIn, tokenOut } = params;
    const routeTransaction = await this.findRouteAndTransaction(params);
    if (routeTransaction) {
      const { route, transaction, percentageFee } = routeTransaction;
      if (route) {
        const result: QuoteData = {
          type: this.type,
          instantRate: calculateRate(
            tokenIn.decimals,
            tokenOut.decimals,
            route.inAmount,
            route.outAmount,
          ),
          sellTokenAddress: getSolanaTokenMint(tokenIn),
          buyTokenAddress: getSolanaTokenMint(tokenOut),
          providers: [
            {
              name: 'Jupiter',
              logoUrl: 'https://common.onekey-asset.com/logo/Jupiter.png',
            },
          ],
          arrivalTime: 30,
          sellAmount: String(route.inAmount),
          buyAmount: String(route.outAmount),
          percentageFee,
          txData: transaction,
        };
        return { data: result };
      }
    }
    return undefined;
  }

  async fetchAdjustedQuote(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    const { tokenIn, tokenOut, typedValue, independentField } = params;
    if (independentField !== 'OUTPUT') {
      return undefined;
    }
    const priceInfo = await this.fetchPrice(tokenIn, tokenOut);
    if (!priceInfo) {
      return;
    }
    const newTypedValue = div(typedValue, priceInfo.price);
    const newParams = { ...params };
    newParams.independentField = 'INPUT';
    newParams.typedValue = newTypedValue;
    const routeTransaction = await this.findRouteAndTransaction(newParams);
    if (routeTransaction) {
      const { route, transaction } = routeTransaction;
      const expectedbuyAmount = new BigNumber(
        getTokenAmountString(tokenOut, typedValue),
      );
      const actualAmount = new BigNumber(route.outAmount);
      const isExpected = actualAmount.isGreaterThan(
        expectedbuyAmount.multipliedBy(0.95),
      );
      if (route && isExpected) {
        const result: QuoteData = {
          type: this.type,
          instantRate: calculateRate(
            tokenIn.decimals,
            tokenOut.decimals,
            route.inAmount,
            route.outAmount,
          ),
          sellTokenAddress: getSolanaTokenMint(tokenIn),
          buyTokenAddress: getSolanaTokenMint(tokenOut),
          providers: [
            {
              name: 'Jupiter',
              logoUrl: 'https://common.onekey-asset.com/logo/Jupiter.png',
            },
          ],
          arrivalTime: 30,
          sellAmount: String(route.inAmount),
          buyAmount: String(getTokenAmountString(tokenOut, typedValue)),
          txData: transaction,
        };
        return { data: result };
      }
    }
    return undefined;
  }

  async fetchQuote(
    params: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    if (params.activeAccount.address !== params.receivingAddress) {
      return;
    }
    const result = await this.fetchRawQuote(params);
    if (result) {
      return result;
    }
    return this.fetchAdjustedQuote(params);
  }

  async buildTransaction(
    params: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    if (params.activeAccount.address !== params.receivingAddress) {
      return;
    }
    const { activeAccount } = params;
    if (params.txData) {
      if (typeof params.txData === 'string') {
        const data = await this.refreshRecentBlockBash(
          activeAccount.id,
          params.txData,
        );
        return { data };
      }
    }

    const routeTransaction = await this.findRouteAndTransaction(params);
    if (routeTransaction) {
      const { transaction } = routeTransaction;
      const data = await this.refreshRecentBlockBash(
        transaction,
        activeAccount.id,
      );
      return { data };
    }
    return undefined;
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const { networkId, accountId, hash } = tx;
    const status =
      await backgroundApiProxy.serviceHistory.queryTransactionByTxid({
        networkId,
        accountId,
        txid: hash,
      });
    return { status };
  }
}
