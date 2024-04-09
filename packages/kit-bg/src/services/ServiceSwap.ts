import axios from 'axios';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type {
  IFetchBuildTxParams,
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchResponse,
  IFetchSwapTxHistoryStatusResponse,
  IFetchTokensParams,
  ISwapNetwork,
  ISwapNetworkBase,
  ISwapToken,
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
    const allClientSupportNetworks =
      await this.backgroundApi.serviceNetwork.getAllNetworks();
    const swapNetworks = data?.data
      ?.map((network) => {
        const clientNetwork = allClientSupportNetworks.networks.find(
          (n) => n.id === network.networkId,
        );
        if (clientNetwork) {
          return {
            name: clientNetwork.name,
            symbol: clientNetwork.symbol,
            shortcode: clientNetwork.shortcode,
            logoURI: clientNetwork.logoURI,
            networkId: network.networkId,
            defaultSelectToken: network.defaultSelectToken,
            explorers: clientNetwork.explorers,
          };
        }
        if (network.networkId === 'all') {
          return {
            ...network,
            name: 'All Network',
            symbol: 'All Net',
            shortcode: 'All',
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
    limit = 50,
    accountAddress,
    accountNetworkId,
    accountXpub,
  }: IFetchTokensParams): Promise<ISwapToken[]> {
    await this.cancelFetchTokenList();
    const params = {
      protocol: EProtocolOfExchange.SWAP,
      networkId: networkId === 'all' ? undefined : networkId,
      keywords,
      limit,
      accountAddress,
      accountNetworkId,
      accountXpub,
    };
    this._tokenListAbortController = new AbortController();
    const client = await this.getClient();
    try {
      const { data } = await client.get<IFetchResponse<ISwapToken[]>>(
        '/swap/v1/tokens',
        {
          params,
          signal: this._tokenListAbortController.signal,
        },
      );
      return data?.data ?? [];
    } catch (e) {
      if (axios.isCancel(e)) {
        throw new Error('swap fetch token cancel', {
          cause: ESwapFetchCancelCause.SWAP_TOKENS_CANCEL,
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
  async fetchSwapTokenDetails({
    networkId,
    accountAddress,
    xpub,
    contractAddress,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    contractAddress: string;
  }): Promise<ISwapToken[] | undefined> {
    const params = {
      protocol: EProtocolOfExchange.SWAP,
      networkId,
      accountAddress,
      xpub,
      contractAddress,
    };
    const client = await this.getClient();
    const { data } = await client.get<IFetchResponse<ISwapToken[]>>(
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
      toNetworkId: toToken.networkId,
      protocol: EProtocolOfExchange.SWAP,
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
    const params: IFetchBuildTxParams = {
      fromTokenAddress: fromToken.contractAddress,
      toTokenAddress: toToken.contractAddress,
      fromTokenAmount,
      toTokenAmount,
      fromNetworkId: fromToken.networkId,
      toNetworkId: toToken.networkId,
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
