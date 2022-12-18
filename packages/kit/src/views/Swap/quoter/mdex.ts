import axios from 'axios';

import type { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { networkProviderInfos, quoterServerEndpoints } from '../config';
import { QuoterType } from '../typings';
import {
  TokenAmount,
  affiliateAddress,
  div,
  feeRecipient,
  nativeTokenAddress,
} from '../utils';

import type {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  FetchQuoteResponse,
  QuoteData,
  Quoter,
  SerializableTransactionReceipt,
  TransactionDetails,
  TransactionProgress,
} from '../typings';
import type { Axios } from 'axios';

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
  sources?: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  estimatedGasTokenRefund?: string;
  allowanceTarget: string;
};

export class MdexQuoter implements Quoter {
  type: QuoterType = QuoterType.mdex;

  private client: Axios;

  constructor() {
    this.client = axios.create({ timeout: 10 * 1000 });
  }

  isSupported(networkA: Network, networkB: Network): boolean {
    return networkA.id === networkB.id && !!quoterServerEndpoints[networkA.id];
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
    const params: Record<string, string> = {
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

    const baseURL = quoterServerEndpoints[tokenIn.networkId];
    if (!baseURL) {
      return;
    }
    const res = await this.client.get(baseURL, { params });

    const data = res.data as QuoteResponse; // eslint-disable-line

    const result: QuoteData = {
      type: this.type,
      instantRate: data.price,
      allowanceTarget: data.allowanceTarget,
      buyAmount: data.buyAmount,
      buyTokenAddress: data.buyTokenAddress,
      sellAmount: data.sellAmount,
      sellTokenAddress: data.sellTokenAddress,
      providers: networkProviderInfos[tokenIn.networkId] ?? [
        { name: 'OneKey Swap' },
      ],
      arrivalTime: 15,
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
    const params: Record<string, string> = {
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
    const baseURL = quoterServerEndpoints[tokenIn.networkId];
    if (!baseURL) {
      return undefined;
    }
    const res = await this.client.get(baseURL, { params });
    // eslint-disable-next-line
    const data = res.data as QuoteResponse;
    return {
      data: { ...data, from: activeAccount.address },
    };
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
