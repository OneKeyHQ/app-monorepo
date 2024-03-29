import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchResponse,
  IFetchSwapTxHistoryStatusResponse,
  IFetchTokensParams,
  ISwapNetwork,
  ISwapNetworkBase,
  ISwapToken,
  ISwapTokenDetailInfo,
} from '@onekeyhq/shared/types/swap/types';
import {
  EProtocolOfExchange,
  ESwapFetchCancelCause,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceSwap extends ServiceBase {
  private _quoteAbortController?: AbortController;

  private _tokenListAbortController?: AbortController;

  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // --------------------- fetch
  @backgroundMethod()
  async cancelFetchQuotes() {
    if (this._quoteAbortController) {
      this._quoteAbortController.abort();
      this._quoteAbortController = undefined;
    }
  }

  @backgroundMethod()
  async cancelFetchTokenList() {
    if (this._tokenListAbortController) {
      this._tokenListAbortController.abort();
      this._tokenListAbortController = undefined;
    }
  }

  @backgroundMethod()
  @toastIfError()
  async fetchSwapNetworks(): Promise<ISwapNetwork[]> {
    const protocol = EProtocolOfExchange.SWAP;
    const params = {
      protocol,
    };
    const client = await this.getClient();
    const { data } = await client.get<IFetchResponse<ISwapNetworkBase[]>>(
      '/swap/v1/networks',
      { params },
    );
    const allNetworks =
      await this.backgroundApi.serviceNetwork.getAllNetworks();
    const swapNetworks = data?.data
      ?.map((network) => {
        const serverNetwork = allNetworks.networks.find(
          (n) => n.id === network.networkId,
        );
        if (serverNetwork) {
          return {
            ...serverNetwork,
            networkId: network.networkId,
            protocol: network.protocol,
            providers: network.providers,
          };
        }
        return null;
      })
      .filter(Boolean);
    return swapNetworks ?? [];
  }

  @backgroundMethod()
  async fetchSwapTokens({
    networkId,
    keywords,
    type,
    limit = 50,
    next,
    accountAddress,
    accountNetworkId,
    accountXpub,
  }: IFetchTokensParams): Promise<{ result: ISwapToken[]; next?: string }> {
    await this.cancelFetchTokenList();
    const params = {
      protocol: EProtocolOfExchange.SWAP,
      networkId: networkId === 'all' ? undefined : networkId,
      keywords,
      type,
      limit,
      next,
      accountAddress,
      accountNetworkId,
      accountXpub,
    };
    this._tokenListAbortController = new AbortController();
    const client = await this.getClient();
    try {
      const { data } = await client.get<
        IFetchResponse<{ next?: string; data: ISwapToken[] }>
      >('/swap/v1/tokens', {
        params,
        signal: this._tokenListAbortController.signal,
      });
      this._tokenListAbortController = undefined;
      return { result: data?.data?.data ?? [], next: data?.data?.next };
    } catch (e) {
      if (axios.isCancel(e)) {
        throw new Error('swap fetch tokens cancel', {
          cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
        });
      } else {
        const error = e as { message: string };
        void this.backgroundApi.serviceApp.showToast({
          method: 'error',
          title: 'error',
          message: error?.message,
        });
        return { result: [], next: undefined };
      }
    }
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
    const { data } = await client.get<IFetchResponse<ISwapTokenDetailInfo>>(
      '/swap/v1/token/detail',
      { params },
    );
    return data?.data;
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
    await this.cancelFetchQuotes();
    const params: IFetchQuotesParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      fromNetworkId: fromToken.networkId,
      fromTokenIsNative: fromToken.isNative,
      toTokenIsNative: toToken.isNative,
      toNetworkId: toToken.networkId,
      fromTokenDecimals: fromToken.decimals,
      toTokenDecimals: toToken.decimals,
      fromTokenSwftCode: fromToken.swapSwftCode,
      toTokenSwftCode: toToken.swapSwftCode,
      protocol: EProtocolOfExchange.SWAP,
      fromProviders: fromToken.providers,
      toProviders: toToken.providers,
      userAddress,
      slippagePercentage,
    };
    this._quoteAbortController = new AbortController();
    const client = await this.getClient();
    const fetchUrl = '/swap/v1/quote';
    try {
      const { data } = await client.get<IFetchResponse<IFetchQuoteResult[]>>(
        fetchUrl,
        {
          params,
          signal: this._quoteAbortController.signal,
        },
      );
      this._quoteAbortController = undefined;
      return data?.data ?? [];
    } catch (e) {
      if (axios.isCancel(e)) {
        throw new Error('swap fetch quote cancel', {
          cause: ESwapFetchCancelCause.SWAP_QUOTE_CANCEL,
        });
      } else {
        const error = e as { message: string };
        void this.backgroundApi.serviceApp.showToast({
          method: 'error',
          title: 'error',
          message: error?.message,
        });
        return [];
      }
    }
  }

  @backgroundMethod()
  @toastIfError()
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
    provider: string;
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
      protocol: EProtocolOfExchange.SWAP,
      provider,
      userAddress,
      receivingAddress,
      slippagePercentage,
    };
    const client = await this.getClient();
    const { data } = await client.get<IFetchResponse<IFetchBuildTxResponse>>(
      '/swap/v1/build-tx',
      { params },
    );
    return data?.data;
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
    protocol?: EProtocolOfExchange;
    provider?: string;
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

    const { data } = await client.post<
      IFetchResponse<IFetchSwapTxHistoryStatusResponse>
    >('/swap/v1/state-tx', params);
    return data?.data ?? { state: ESwapTxHistoryStatus.PENDING };
  }

  @backgroundMethod()
  async fetchApproveAllowance({
    networkId,
    tokenAddress,
    spenderAddress,
    walletAddress,
  }: {
    networkId: string;
    tokenAddress: string;
    spenderAddress: string;
    walletAddress: string;
  }) {
    const params = {
      networkId,
      tokenAddress,
      spenderAddress,
      walletAddress,
    };
    const client = await this.getClient();

    const { data } = await client.get<IFetchResponse<string>>(
      '/swap/v1/allowance',
      { params },
    );
    return data?.data;
  }
}
