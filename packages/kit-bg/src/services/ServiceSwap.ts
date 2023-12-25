import axios from 'axios';

import { CrossChainSwapProviders } from '@onekeyhq/kit/src/views/Swap/config/SwapProvider.constants';
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
  private _quoteCancelSource?: CancelTokenSource;

  private _tokensCancelSource?: CancelTokenSource;

  // --------------------- fetch
  @backgroundMethod()
  async cancelQuoteFetchQuotes() {
    if (this._quoteCancelSource) {
      this._quoteCancelSource.cancel('quote request canceled');
    }
  }

  @backgroundMethod()
  async fetchSwapNetworks(): Promise<ISwapNetwork[]> {
    const protocol = EExchangeProtocol.SWAP;
    const params = {
      protocol,
    };
    const client = await this.getClient();
    try {
      const { data } = await client.get<IFetchResponse<ISwapNetwork[]>>(
        '/exchange/networks',
        { params },
      );
      if (data.code === 0 && data.data) {
        return data.data;
      }
    } catch (e) {
      // TODO: toast
      console.error('fetchSwapNetworks--error', e);
    }
    return [];
  }

  @backgroundMethod()
  async fetchSwapTokens({
    networkId,
    keywords,
    fromToken,
    type,
    limit = 50,
    next,
  }: {
    type: 'from' | 'to';
    networkId?: string;
    keywords?: string;
    fromToken?: ISwapToken;
    limit?: number;
    next?: string;
  }): Promise<{ result: ISwapToken[]; next?: string }> {
    if (this._tokensCancelSource) {
      this._tokensCancelSource.cancel('tokens request canceled');
    }
    const providersArr = fromToken?.providers.split(',');
    const params = {
      fromTokenNetworkId: fromToken?.networkId,
      fromTokenProviders: fromToken?.providers,
      fromTokenAddress: fromToken?.contractAddress,
      protocol: EExchangeProtocol.SWAP,
      networkId: networkId === 'all' ? undefined : networkId,
      keywords,
      fromTokenSwapSwftUnSupportCode: providersArr?.every(
        (item) => item === ESwapProviders.SWFT,
      )
        ? fromToken?.swapSwftUnSupportCode
        : undefined,
      type,
      limit,
      next,
    };
    this._tokensCancelSource = axios.CancelToken.source();
    const fetchUrl = `${getFiatEndpoint()}/exchange/tokens`;
    // const client = await this.getClient();
    try {
      const { data } = await axios.get<
        IFetchResponse<{ next?: string; data: ISwapToken[] }>
      >(fetchUrl, { params, cancelToken: this._tokensCancelSource.token });
      if (data?.code === 0 && data?.data) {
        return { result: data.data.data, next: data.data.next };
      }
    } catch (e) {
      if (axios.isCancel(e)) {
        throw new Error('cancel');
      } else {
        // TODO: toast
        console.error('fetchSwapTokens--error', e);
        return { result: [], next: undefined };
      }
    } finally {
      this._tokensCancelSource = undefined;
    }
    return { result: [], next: undefined };
  }

  @backgroundMethod()
  async fetchQuotes({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromTokenAmount: string;
    userAddress?: string;
  }): Promise<IFetchQuoteResult[]> {
    if (this._quoteCancelSource) {
      this._quoteCancelSource.cancel('quote request canceled');
    }
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
      userAddress,
    };
    this._quoteCancelSource = axios.CancelToken.source();
    const fetchUrl = `${getFiatEndpoint()}/exchange/quote`;
    try {
      const { data } = await axios.get<IFetchResponse<IFetchQuoteResult[]>>(
        fetchUrl,
        { params, cancelToken: this._quoteCancelSource.token },
      );
      this._quoteCancelSource = undefined;
      if (data.code === 0 && data.data) {
        return data.data;
      }
    } catch (e) {
      if (axios.isCancel(e)) {
        console.error('fetchQuote--cancel', e);
        throw new Error('cancel');
      } else {
        // TODO: toast
        console.error('fetchQuotes--error', e);
      }
    }
    return [];
  }

  @backgroundMethod()
  async fetchBuildTx({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
    toTokenAmount,
    provider,
    receivingAddress,
    slippagePercentage,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    toTokenAmount: string;
    fromTokenAmount: string;
    provider: ESwapProviders;
    userAddress: string;
    receivingAddress: string;
    slippagePercentage: string;
  }): Promise<IFetchBuildTxResponse | undefined> {
    const params = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      toTokenAmount,
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
    const client = await this.getClient();

    const { data } = await client.get<IFetchResponse<IFetchBuildTxResponse>>(
      '/exchange/build_tx',
      { params },
    );
    if (data.code === 0 && data.data) {
      return data.data;
    }
    throw new Error('fetchBuildTx error');
  }
}
