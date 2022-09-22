import axios, { Axios } from 'axios';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { estimatedTime, zeroXServerEndpoints } from '../config';
import {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  FetchQuoteResponse,
  QuoteData,
  Quoter,
  QuoterType,
  SerializableTransactionReceipt,
  TransactionDetails,
  TransactionProgress,
} from '../typings';
import {
  TokenAmount,
  affiliateAddress,
  div,
  feeRecipient,
  nativeTokenAddress,
} from '../utils';

type QuoteParams = {
  sellToken: string;
  buyToken: string;
  slippagePercentage: string;
  feeRecipient: string;
  affiliateAddress: string;
  sellAmount?: string;
  buyAmount?: string;
  takerAddress?: string;
};

type QuoteResponse = {
  price: string;
  guaranteedPrice: string;
  to: string;
  data: string;
  value: string;
  gasPrice?: string;
  gas?: string;
  estimatedGas?: string;
  protocolFee?: string;
  minimumProtocolFee?: string;
  buyAmount: string;
  sellAmount: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  estimatedGasTokenRefund?: string;
  allowanceTarget: string;
  sources: { name: string; proportion: string }[];
};

export class SimpleQuoter implements Quoter {
  type: QuoterType = QuoterType.zeroX;

  private client: Axios;

  constructor() {
    this.client = axios.create({ timeout: 10 * 1000 });
  }

  isSupported(networkA: Network, networkB: Network): boolean {
    return networkA.id === networkB.id && !!zeroXServerEndpoints[networkA.id];
  }

  getProviderLogo(name: string): string {
    return `https://common.onekey-asset.com/logo/${name}.png`;
  }

  private async fetch0xQuote(
    baseURL: string,
    params: QuoteParams,
  ): Promise<{
    data: QuoteResponse;
    providers: { name: string; logoUrl?: string }[];
  }> {
    const res = await this.client.get(baseURL, { params });
    const data = res.data.data as QuoteResponse; // eslint-disable-line
    const sources = data?.sources.filter((i) => Number(i.proportion) > 0);
    const providers = sources.map((item) => ({
      name: item.name,
      logoUrl: this.getProviderLogo(item.name),
    }));
    return { providers, data };
  }

  async fetchQuote(
    quoteParams: FetchQuoteParams,
  ): Promise<FetchQuoteResponse | undefined> {
    const {
      networkIn,
      networkOut,
      tokenIn,
      tokenOut,
      slippagePercentage,
      independentField,
      typedValue,
      activeAccount,
      receivingAddress,
    } = quoteParams;
    if (
      !this.isSupported(networkIn, networkOut) ||
      receivingAddress !== activeAccount.address
    ) {
      return;
    }
    const swapSlippagePercent = +slippagePercentage / 100;
    const params: QuoteParams = {
      sellToken: tokenIn.tokenIdOnNetwork || nativeTokenAddress,
      buyToken: tokenOut.tokenIdOnNetwork || nativeTokenAddress,
      slippagePercentage: Number.isNaN(swapSlippagePercent)
        ? '0.03'
        : String(swapSlippagePercent),
      feeRecipient,
      affiliateAddress,
    };
    if (independentField === 'INPUT') {
      params.sellAmount = new TokenAmount(tokenIn, typedValue).toFormat();
    } else {
      params.buyAmount = new TokenAmount(tokenOut, typedValue).toFormat();
    }

    const baseURL = zeroXServerEndpoints[tokenIn.networkId];
    if (!baseURL) {
      return;
    }

    const { providers, data } = await this.fetch0xQuote(baseURL, params);

    const result: QuoteData = {
      type: this.type,
      instantRate: data.price,
      allowanceTarget: data.allowanceTarget,
      buyAmount: data.buyAmount,
      buyTokenAddress: data.buyTokenAddress,
      sellAmount: data.sellAmount,
      sellTokenAddress: data.sellTokenAddress,
      arrivalTime: estimatedTime[networkIn.id] ?? 30,
      providers,
    };

    if (data.data) {
      result.txData = {
        from: activeAccount.address,
        to: data.to,
        data: data.data,
        value: data.value,
      };
    }
    if (independentField === 'INPUT') {
      result.instantRate = data.price;
    } else {
      result.instantRate = div(1, data.price);
    }
    return { data: result };
  }

  async buildTransaction(
    quoteParams: BuildTransactionParams,
  ): Promise<BuildTransactionResponse | undefined> {
    const {
      networkIn,
      networkOut,
      tokenIn,
      tokenOut,
      slippagePercentage,
      independentField,
      typedValue,
      activeAccount,
      txData,
      receivingAddress,
    } = quoteParams;
    if (
      !this.isSupported(networkIn, networkOut) ||
      receivingAddress !== activeAccount.address
    ) {
      return;
    }
    if (txData) {
      return { data: txData };
    }
    const swapSlippagePercent = +slippagePercentage / 100;
    const params: QuoteParams = {
      sellToken: tokenIn.tokenIdOnNetwork || nativeTokenAddress,
      buyToken: tokenOut.tokenIdOnNetwork || nativeTokenAddress,
      slippagePercentage: Number.isNaN(swapSlippagePercent)
        ? '0.03'
        : String(swapSlippagePercent),
      feeRecipient,
      affiliateAddress,
      takerAddress: activeAccount.address,
    };
    if (independentField === 'INPUT') {
      params.sellAmount = new TokenAmount(tokenIn, typedValue).toFormat();
    } else {
      params.buyAmount = new TokenAmount(tokenOut, typedValue).toFormat();
    }
    const baseURL = zeroXServerEndpoints[tokenIn.networkId];
    if (!baseURL) {
      return undefined;
    }
    const { data } = await this.fetch0xQuote(baseURL, params);

    return { data: { ...data, from: activeAccount.address } };
  }

  async queryTransactionProgress(
    tx: TransactionDetails,
  ): Promise<TransactionProgress> {
    const { networkId, accountId, nonce } = tx;
    if (nonce !== undefined) {
      const status =
        await backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
          networkId,
          accountId,
          nonce,
        });
      return { status };
    }
    const result = (await backgroundApiProxy.serviceNetwork.rpcCall(networkId, {
      method: 'eth_getTransactionReceipt',
      params: [tx.hash],
    })) as SerializableTransactionReceipt | undefined;
    if (result) {
      return { status: Number(result.status) === 1 ? 'sucesss' : 'failed' };
    }

    if (Date.now() - tx.addedTime > 60 * 60 * 1000) {
      return { status: 'failed' };
    }
    return undefined;
  }
}
