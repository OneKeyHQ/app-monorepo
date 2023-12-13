import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getFiatEndpoint } from '@onekeyhq/shared/src/config/endpoint';

import ServiceBase from './ServiceBase';

import type { CancelTokenSource } from 'axios';

export enum ESwapProtocolType {
  SWAP = 'swap',
}

export enum ESwapProvider {
  ONE_INCH = '1inch',
  SWFT = 'swft',
}

export interface ISwapToken {
  networkId: string;
  providers: string;
  protocolTypes: string;
  contractAddress: string; // native token ''
  symbol: string;
  decimals: number;
  logoURI?: string;
  swft_coinCode?: string;
  swft_noSupportCoins?: string;
  unSupported?: boolean;
}

interface IFetchQuotesParams {
  fromNetworkId: string;
  toNetworkId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromTokenAmount: string;
  protocolTypes: string;
  providers: string;
  fromTokenDecimals: number;
  toTokenDecimals: number;
  fromTokenSwftCode?: string;
  toTokenSwftCode?: string;
  userAddress?: string;
  receivingAddress?: string;
  slippagePercentage?: string;
}

export interface ISwapNetwork {
  networkId: string;
  protocolTypes: string;
  providers: string;
  unSupported?: boolean;
}

export type IFetchQuoteLimit = {
  max?: string;
  min?: string;
};

export interface IFetchQuoteResponse {
  quoteResult: IFetchQuoteResult;
  limit?: IFetchQuoteLimit;
}

export interface IFetchSwapResponse {
  quoteResult: IFetchQuoteResult;
  tx?: ITransaction;
  order?: IFetchSwftOrderResponse;
}

export interface IFetchQuoteFee {
  percentageFee: number; // oneKey fee percentage
  protocolFees?: IFeeInfo[];
  netWorkFees?: INetworkFee[];
}

interface IFeeTokenAsset {
  address: string;
  networkId: string;
  decimals: number;
  symbol?: string;
  logoURI?: string;
}

export interface IFeeInfo {
  amount: string;
  asset?: IFeeTokenAsset;
}

export interface INetworkFee {
  gas?: string;
  value?: IFeeInfo;
}

export interface IEVMTransaction {
  to: string;
  value: string;
  data: string;
}

export type ITransaction = IEVMTransaction;

export interface IFetchQuoteInfo {
  provider: string;
  protocolType: string;
  providerLogo?: string;
  protocolLogo?: string;
}

export interface IFetchQuoteResult {
  info: IFetchQuoteInfo;
  toAmount: string;
  finialAmount: string; // after protocolFees + oneKeyFee
  fee: IFetchQuoteFee;
  allowanceTarget?: string;
  arrivalTime?: number;
}

export interface IFetchSwftOrderResponse {
  platformAddr: string;
  depositCoinAmt: string;
  depositCoinCode: string;
  receiveCoinAmt: string;
  receiveCoinCode: string;
  orderId: string;
}

interface IFetchResponse<T> {
  code: number;
  data: T;
  message: string;
}

export const SingleChainSwapProviders: (ESwapProvider | string)[] = [
  ESwapProvider.ONE_INCH,
];
export const CrossChainSwapProviders: (ESwapProtocolType | string)[] = [
  ESwapProvider.SWFT,
];

@backgroundClass()
export default class ServiceSwap extends ServiceBase {
  private _cancelSource?: CancelTokenSource;

  // --------------------- fetch
  @backgroundMethod()
  async cancelFetchQuotes() {
    if (this._cancelSource) {
      this._cancelSource.cancel('quote request canceled');
    }
  }

  @backgroundMethod()
  async fetchSwapNetworks(): Promise<ISwapNetwork[]> {
    const baseUrl = getFiatEndpoint();
    const providers = [ESwapProvider.ONE_INCH, ESwapProvider.SWFT];
    const protocolTypes = [ESwapProtocolType.SWAP];
    const params = {
      providers: providers.join(','),
      protocolTypes: protocolTypes.join(','),
    };
    const fetchUrl = `${baseUrl}/exchange/support/networks`;
    const { data } = await this.client.get<IFetchResponse<ISwapNetwork[]>>(
      fetchUrl,
      { params },
    );
    if (data.code === 0 && data.data) {
      return data.data;
    }
    return [];
  }

  @backgroundMethod()
  async fetchSwapTokens(network: ISwapNetwork) {
    const baseUrl = getFiatEndpoint();
    const params = {
      providers: network.providers,
      protocolTypes: network.protocolTypes,
      networkId: network.networkId,
    };
    const fetchUrl = `${baseUrl}/exchange/support/tokens`;
    const { data } = await this.client.get<IFetchResponse<ISwapToken[]>>(
      fetchUrl,
      { params },
    );
    if (data.code === 0 && data.data) {
      return data.data;
    }
    return [];
  }

  @backgroundMethod()
  async fetchQuotes({
    fromToken,
    toToken,
    fromTokenAmount,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromTokenAmount: string;
  }) {
    if (this._cancelSource) {
      this._cancelSource.cancel('quote request canceled');
    }
    const fetchUrl = `${getFiatEndpoint()}/exchange/quote`;
    const fromProtocolTypesArr = fromToken.protocolTypes.split(',');
    const fromProvidersArr = fromToken.providers.split(',');
    const toProtocolTypesArr = toToken.protocolTypes.split(',');
    const toProvidersArr = toToken.providers.split(',');
    const supportedProtocolTypes = fromProtocolTypesArr.filter((item) =>
      toProtocolTypesArr.includes(item),
    );
    const supportedProviders = fromProvidersArr.filter((item) =>
      toProvidersArr.includes(item),
    );
    const params: IFetchQuotesParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      fromTokenDecimals: fromToken.decimals,
      toTokenDecimals: toToken.decimals,
      fromTokenSwftCode: fromToken.swft_coinCode,
      toTokenSwftCode: toToken.swft_coinCode,
      protocolTypes: supportedProtocolTypes.join(','),
      providers: supportedProviders.join(','),
    };
    console.log('fetchQuote--', params);
    this._cancelSource = axios.CancelToken.source();
    try {
      const { data } = await axios.get<IFetchResponse<IFetchQuoteResponse[]>>(
        fetchUrl,
        { params, cancelToken: this._cancelSource.token },
      );
      console.log('fetchQuote--data', data);
      if (data.code === 0 && data.data) {
        return data.data;
      }
    } catch (e) {
      if (axios.isCancel(e)) {
        console.error('fetchQuote--cancel', e);
        throw new Error('cancel');
      } else {
        throw e;
      }
    }
  }

  @backgroundMethod()
  async fetchSwap({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
    receivingAddress,
    slippagePercentage,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromTokenAmount: string;
    userAddress: string;
    receivingAddress: string;
    slippagePercentage: string;
  }) {
    // todo
    // 检查  余额
    // 检查  授权
    // 如果需要授权交易，则 fetch api 获取授权交易
    // fetch swap 获取交易信息
    // 展示  swap 确认信息

    const fetchUrl = `${getFiatEndpoint()}/exchange/swap`;
    const fromProtocolTypesArr = fromToken.protocolTypes.split(',');
    const fromProvidersArr = fromToken.providers.split(',');
    const toProtocolTypesArr = toToken.protocolTypes.split(',');
    const toProvidersArr = toToken.providers.split(',');
    const supportedProtocolTypes = fromProtocolTypesArr.filter((item) =>
      toProtocolTypesArr.includes(item),
    );
    const supportedProviders = fromProvidersArr.filter((item) =>
      toProvidersArr.includes(item),
    );
    const params = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      fromTokenDecimals: fromToken.decimals,
      toTokenDecimals: toToken.decimals,
      fromTokenSwftCode: fromToken.swft_coinCode,
      toTokenSwftCode: toToken.swft_coinCode,
      protocolTypes: supportedProtocolTypes.join(','),
      providers: supportedProviders.join(','),
      userAddress,
      receivingAddress,
      slippagePercentage,
    };
    console.log('fetchSwap--', params);
    const { data } = await axios.get<IFetchResponse<IFetchSwapResponse>>(
      fetchUrl,
      { params },
    );
    console.log('fetchSwap--data', data);
    if (data.code === 0 && data.data) {
      return data.data;
    }
  }
}
