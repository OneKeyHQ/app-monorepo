import axios from 'axios';

import {
  CrossChainSwapProviders,
  SingleChainSwapProviders,
} from '@onekeyhq/kit/src/views/Swap/config/SwapProvider.constants';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchResponse,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/kit/src/views/Swap/types';
import {
  EExchangeProtocol,
  ESwapProviders,
} from '@onekeyhq/kit/src/views/Swap/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getFiatEndpoint } from '@onekeyhq/shared/src/config/endpoint';

import ServiceBase from './ServiceBase';

import type { CancelTokenSource } from 'axios';

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
    const protocol = EExchangeProtocol.SWAP;
    const params = {
      protocol,
    };
    const fetchUrl = `${baseUrl}/exchange/networks`;
    const { data } = await this.client.get<IFetchResponse<ISwapNetwork[]>>(
      fetchUrl,
      { params },
    );
    console.log('fetchSwapNetworks--data', data);
    if (data.code === 0 && data.data) {
      return data.data;
    }
    throw new Error('fetchSwapNetworks error');
  }

  @backgroundMethod()
  async fetchSwapTokens({
    networkId,
    keyword,
    fromToken,
    type,
    limit = 20,
    next,
  }: {
    type: 'from' | 'to';
    networkId?: string;
    keyword?: string;
    fromToken?: ISwapToken;
    limit?: number;
    next?: string;
  }): Promise<{ result: ISwapToken[]; next?: string }> {
    const baseUrl = getFiatEndpoint();
    const providersArr = fromToken?.providers.split(',');
    const params = {
      fromTokenNetworkId: fromToken?.networkId,
      fromTokenProviders: fromToken?.providers,
      fromTokenAddress: fromToken?.contractAddress,
      protocol: EExchangeProtocol.SWAP,
      networkId: networkId === 'all' ? undefined : networkId,
      keyword,
      fromTokenSwapSwftUnSupportCode: providersArr?.every(
        (item) => item === ESwapProviders.SWFT,
      )
        ? fromToken?.swapSwftUnSupportCode
        : undefined,
      type,
      limit,
      next,
    };
    const fetchUrl = `${baseUrl}/exchange/tokens`;
    const { data } = await this.client.get<
      IFetchResponse<{ next?: string; data: ISwapToken[] }>
    >(fetchUrl, { params });
    console.log('fetchSwapTokens--data', data);
    if (data?.code === 0 && data?.data) {
      return { result: data.data.data, next: data.data.next };
    }
    throw new Error('fetchSwapTokens error');
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
    const fromProvidersArr = fromToken.providers.split(',');
    const toProvidersArr = toToken.providers.split(',');
    let supportedProviders = fromProvidersArr.filter((item) =>
      toProvidersArr.includes(item),
    ) as ESwapProviders[];
    if (fromToken.networkId !== toToken.networkId) {
      supportedProviders = supportedProviders.filter((item: ESwapProviders) =>
        CrossChainSwapProviders.includes(item),
      );
    }
    const params: IFetchQuotesParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      fromTokenDecimals: fromToken.decimals,
      toTokenDecimals: toToken.decimals,
      fromTokenSwftCode: fromToken.swapSwftCode,
      toTokenSwftCode: toToken.swapSwftCode,
      protocol: EExchangeProtocol.SWAP,
      providers: supportedProviders.join(','),
    };
    console.log('fetchQuote--', params);
    this._cancelSource = axios.CancelToken.source();
    try {
      const { data } = await axios.get<IFetchResponse<IFetchQuoteResult[]>>(
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
    provider,
    receivingAddress,
    slippagePercentage,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromTokenAmount: string;
    provider: ESwapProviders;
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

    const fetchUrl = `${getFiatEndpoint()}/exchange/build_tx`;
    const params = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
      fromTokenDecimals: fromToken.decimals,
      toTokenDecimals: toToken.decimals,
      fromTokenSwftCode: fromToken.swapSwftCode,
      toTokenSwftCode: toToken.swapSwftCode,
      protocol: EExchangeProtocol.SWAP,
      provider,
      userAddress,
      receivingAddress,
      slippagePercentage,
    };
    console.log('fetchSwap--', params);
    const { data } = await axios.get<IFetchResponse<IFetchBuildTxResponse>>(
      fetchUrl,
      { params },
    );
    console.log('fetchSwap--data', data);
    if (data.code === 0 && data.data) {
      return data.data;
    }
  }
}
