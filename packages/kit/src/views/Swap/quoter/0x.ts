import axios, { Axios } from 'axios';

import { Network } from '@onekeyhq/engine/src/types/network';

import { QuoteParams, Quoter, SwapQuote, TxParams, TxRes } from '../typings';
import {
  TokenAmount,
  affiliateAddress,
  div,
  feeRecipient,
  getChainIdFromNetwork,
  nativeTokenAddress,
} from '../utils';

enum Chains {
  MAINNET = '1',
  ROPSTEN = '3',
  KOVAN = '42',
  BSC = '56',
  POLYGON = '137',
  FANTOM = '250',
  AVALANCHE = '43114',
}

const NETWORKS: Record<string, string> = {
  [Chains.MAINNET]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ethereum',
  [Chains.ROPSTEN]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=ropsten',
  [Chains.KOVAN]: 'https://kovan.api.0x.org/swap/v1/quote',
  [Chains.BSC]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=bsc',

  [Chains.POLYGON]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=polygon',
  [Chains.FANTOM]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=fantom',
  [Chains.AVALANCHE]:
    'https://defi.onekey.so/onestep/api/v1/trade_order/quote?chainID=avalanche',
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
  sources?: string;
  buyTokenAddress: string;
  sellTokenAddress: string;
  estimatedGasTokenRefund?: string;
  allowanceTarget: string;
};

export class SimpleQuoter implements Quoter {
  private client: Axios;

  constructor() {
    this.client = axios.create({ timeout: 10 * 1000 });
  }

  isSupported(networkA: Network, networkB: Network): boolean {
    return (
      networkA.id === networkB.id && !!NETWORKS[getChainIdFromNetwork(networkA)]
    );
  }

  async getQuote(rateParams: QuoteParams): Promise<SwapQuote | undefined> {
    const {
      networkIn,
      networkOut,
      tokenIn,
      tokenOut,
      slippagePercentage,
      independentField,
      typedValue,
    } = rateParams;
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
    const baseURL = NETWORKS[getChainIdFromNetwork(networkOut)];
    const res = await this.client.get(baseURL, { params });
    // eslint-disable-next-line
    const data = res.data.data as QuoteResponse;
    if (independentField === 'INPUT') {
      return {
        allowanceTarget: data.allowanceTarget,
        buyAmount: data.buyAmount,
        buyTokenAddress: data.buyTokenAddress,
        sellAmount: data.sellAmount,
        sellTokenAddress: data.sellTokenAddress,
        instantRate: data.price,
      };
    }
    return {
      allowanceTarget: data.allowanceTarget,
      buyAmount: data.buyAmount,
      buyTokenAddress: data.buyTokenAddress,
      sellAmount: data.sellAmount,
      sellTokenAddress: data.sellTokenAddress,
      instantRate: div(1, data.price),
    };
  }

  async encodeTx(quoteParams: TxParams): Promise<TxRes | undefined> {
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
    if (!this.isSupported(networkIn, networkOut) && !activeAccount) {
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
    const baseURL = NETWORKS[getChainIdFromNetwork(networkOut)];
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
}
