import axios, { Axios } from 'axios';

import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { networkRecords } from '../config';
import {
  BuildTransactionParams,
  BuildTransactionResponse,
  FetchQuoteParams,
  QuoteData,
  Quoter,
  QuoterType,
  SerializableTransactionReceipt,
  TransactionDetails,
  TransactionStatus,
} from '../typings';
import {
  TokenAmount,
  affiliateAddress,
  div,
  feeRecipient,
  getChainIdFromNetwork,
  nativeTokenAddress,
} from '../utils';

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

export class SimpleQuoter implements Quoter {
  type: QuoterType = QuoterType.zeroX;

  private client: Axios;

  constructor() {
    this.client = axios.create({ timeout: 10 * 1000 });
  }

  isSupported(networkA: Network, networkB: Network): boolean {
    return (
      networkA.id === networkB.id &&
      !!networkRecords[getChainIdFromNetwork(networkA)]
    );
  }

  async fetchQuote(
    quoteParams: FetchQuoteParams,
  ): Promise<QuoteData | undefined> {
    const {
      networkIn,
      networkOut,
      tokenIn,
      tokenOut,
      slippagePercentage,
      independentField,
      typedValue,
      activeAccount,
    } = quoteParams;
    if (!this.isSupported(networkIn, networkOut)) {
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
    const baseURL = networkRecords[getChainIdFromNetwork(networkOut)];
    if (!baseURL) {
      return;
    }
    const res = await this.client.get(baseURL, { params });

    const data = res.data.data as QuoteResponse; // eslint-disable-line

    const result: QuoteData = {
      type: this.type,
      instantRate: data.price,
      allowanceTarget: data.allowanceTarget,
      buyAmount: data.buyAmount,
      buyTokenAddress: data.buyTokenAddress,
      sellAmount: data.sellAmount,
      sellTokenAddress: data.sellTokenAddress,
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
    return result;
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
    } = quoteParams;
    if (!this.isSupported(networkIn, networkOut) && !activeAccount) {
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
    const baseURL = networkRecords[getChainIdFromNetwork(networkOut)];
    if (!baseURL) {
      return undefined;
    }
    const res = await this.client.get(baseURL, { params });
    // eslint-disable-next-line
    const data = res.data.data as QuoteResponse;
    return {
      data: {
        ...data,
        from: activeAccount.address,
      },
    };
  }

  async queryTransactionStatus(
    tx: TransactionDetails,
  ): Promise<TransactionStatus | undefined> {
    const { networkId, accountId, nonce } = tx;
    if (nonce) {
      return backgroundApiProxy.serviceHistory.queryTransactionNonceStatus({
        networkId,
        accountId,
        nonce,
      });
    }
    const result = (await backgroundApiProxy.serviceNetwork.rpcCall(networkId, {
      method: 'eth_getTransactionReceipt',
      params: [tx.hash],
    })) as SerializableTransactionReceipt | undefined;
    if (result) {
      return Number(result.status) === 1 ? 'sucesss' : 'failed';
    }

    if (Date.now() - tx.addedTime > 60 * 60 * 1000) {
      return 'failed';
    }
    return undefined;
  }
}
