import axios from 'axios';

// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { Toast } from '@onekeyhq/components';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { CrossChainSwapProviders } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchResponse,
  IFetchSwapTxHistoryStatusResponse,
  IFetchTokensParams,
  ISwapNetwork,
  ISwapToken,
  ISwapTokenDetailInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EExchangeProtocol,
  ESwapProviders,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import { getEndpoints } from '../endpoints';

import ServiceBase from './ServiceBase';

import type { CancelTokenSource } from 'axios';

@backgroundClass()
export default class ServiceSwap extends ServiceBase {
  private _quoteCancelSource?: CancelTokenSource;

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
        '/swap/v1/networks',
        { params },
      );
      if (data?.data) {
        return data.data;
      }
      Toast.error({ title: 'error', message: data?.message });
    } catch (e) {
      const error = e as { message: string };
      Toast.error({ title: 'error', message: error?.message });
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
    accountAddress,
    accountNetworkId,
    accountXpub,
  }: IFetchTokensParams): Promise<{ result: ISwapToken[]; next?: string }> {
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
      accountAddress,
      accountNetworkId,
      accountXpub,
    };
    const client = await this.getClient();
    try {
      const { data } = await client.get<
        IFetchResponse<{ next?: string; data: ISwapToken[] }>
      >('/swap/v1/tokens', {
        params,
      });
      if (data?.data) {
        return { result: data.data.data, next: data.data.next };
      }
      Toast.error({ title: 'error', message: data?.message });
    } catch (e) {
      const error = e as { message: string };
      Toast.error({ title: 'error', message: error?.message });
    }
    return { result: [], next: undefined };
  }

  @backgroundMethod()
  async fetchSwapTokenDetails({
    networkId,
    accountAddress,
    xpub,
    contractAddress,
  }: {
    networkId: string;
    accountAddress: string;
    xpub?: string;
    contractAddress: string;
  }): Promise<ISwapTokenDetailInfo | undefined> {
    const params = {
      networkId,
      accountAddress,
      xpub,
      contractAddress,
    };
    const client = await this.getClient();
    try {
      const { data } = await client.get<IFetchResponse<ISwapTokenDetailInfo>>(
        '/swap/v1/token/detail',
        { params },
      );
      if (data?.data) {
        return data.data;
      }
      Toast.error({ title: 'error', message: data?.message });
    } catch (e) {
      const error = e as { message: string };
      Toast.error({ title: 'error', message: error?.message });
    }
    return undefined;
  }

  @backgroundMethod()
  async fetchQuotes({
    fromToken,
    toToken,
    fromTokenAmount,
    userAddress,
    slippagePercentage,
  }: {
    fromToken: ISwapToken;
    toToken: ISwapToken;
    fromTokenAmount: string;
    userAddress?: string;
    slippagePercentage: number;
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
      slippagePercentage,
    };
    this._quoteCancelSource = axios.CancelToken.source();
    const endpoints = await getEndpoints();
    const fetchUrl = '/swap/v1/quote';
    try {
      const { data } = await axios.get<IFetchResponse<IFetchQuoteResult[]>>(
        fetchUrl,
        {
          params,
          cancelToken: this._quoteCancelSource.token,
          baseURL: endpoints.http,
        },
      );
      this._quoteCancelSource = undefined;
      if (data.code === 0 && data.data) {
        return data.data;
      }
      Toast.error({ title: 'error', message: data?.message });
    } catch (e) {
      if (axios.isCancel(e)) {
        throw new Error('cancel');
      } else {
        const error = e as { message: string };
        Toast.error({ title: 'error', message: error?.message });
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
    slippagePercentage: number;
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
    try {
      const { data } = await client.get<IFetchResponse<IFetchBuildTxResponse>>(
        '/swap/v1/build-tx',
        { params },
      );
      if (data?.data) {
        return data.data;
      }
      Toast.error({ title: 'error', message: data?.message });
    } catch (e) {
      const error = e as { message: string };
      Toast.error({ title: 'error', message: error?.message });
    }
    return undefined;
  }

  @backgroundMethod()
  async fetchTxState({
    txId,
    provider,
    networkId,
    protocol,
    toTokenAddress,
    receivedAddress,
    ctx,
  }: {
    txId: string;
    toTokenAddress?: string;
    receivedAddress?: string;
    networkId: string;
    protocol?: EExchangeProtocol;
    provider?: ESwapProviders;
    ctx?: any;
  }): Promise<IFetchSwapTxHistoryStatusResponse> {
    const params = {
      txId,
      protocol,
      provider,
      ctx,
      networkId,
      toTokenAddress,
      receivedAddress,
    };
    const client = await this.getClient();
    try {
      const { data } = await client.post<
        IFetchResponse<IFetchSwapTxHistoryStatusResponse>
      >('/swap/v1/state-tx', params);
      if (data?.data) {
        return data.data;
      }
      Toast.error({ title: 'error', message: data?.message });
    } catch (e) {
      const error = e as { message: string };
      Toast.error({ title: 'error', message: error?.message });
    }
    return { state: ESwapTxHistoryStatus.PENDING };
  }
}
