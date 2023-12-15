import axios from 'axios';

import type {
  ESwapProviders,
  IFetchQuoteResponse,
  IFetchQuotesParams,
  IFetchResponse,
  IFetchSwapResponse,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/kit/src/views/Swap/types';
import { EExchangeProtocol } from '@onekeyhq/kit/src/views/Swap/types';
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
    // const baseUrl = getFiatEndpoint();
    // const protocol = EExchangeProtocol.SWAP;
    // const params = {
    //   protocol,
    // };
    // const fetchUrl = `${baseUrl}/exchange/networks`;
    // const { data } = await this.client.get<IFetchResponse<ISwapNetwork[]>>(
    //   fetchUrl,
    //   { params },
    // );
    // if (data.code === 0 && data.data) {
    //   return data.data;
    // }
    return [
      {
        networkId: 'evm--1',
        protocol: EExchangeProtocol.SWAP,
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
      },
      {
        networkId: 'evm--2',
        protocol: EExchangeProtocol.SWAP,
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
      },
      {
        networkId: 'evm--3',
        protocol: EExchangeProtocol.SWAP,
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
      },
      {
        networkId: 'evm--4',
        protocol: EExchangeProtocol.SWAP,
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
      },
      {
        networkId: 'evm--5',
        protocol: EExchangeProtocol.SWAP,
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
      },
      {
        networkId: 'evm--6',
        protocol: EExchangeProtocol.SWAP,
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
      },
      {
        networkId: 'evm--7',
        protocol: EExchangeProtocol.SWAP,
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
      },
    ];
  }

  @backgroundMethod()
  async fetchSwapTokens({
    networkId,
    keyword,
    fromToken,
    type,
  }: {
    type: 'from' | 'to';
    networkId?: string;
    keyword?: string;
    fromToken?: ISwapToken;
  }) {
    // const baseUrl = getFiatEndpoint();
    // const params = {
    //   providers: fromToken?.providers,
    //   protocol: EExchangeProtocol.SWAP,
    //   networkId,
    //   keyword,
    //   type,
    // };
    // const fetchUrl = `${baseUrl}/exchange/tokens`;
    // const { data } = await this.client.get<IFetchResponse<ISwapToken[]>>(
    //   fetchUrl,
    //   { params },
    // );
    // if (data?.code === 0 && data?.data) {
    //   return data.data;
    // }
    if (networkId === 'evm--1') {
      return [
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--1',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--1',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--1',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--1',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--1',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
      ];
    }
    if (networkId === 'evm--2') {
      return [
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--2',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH2',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--2',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH2',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
      ];
    }
    if (networkId === 'evm--3') {
      return [
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--3',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH3',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--3',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH3',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--3',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH3',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--3',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH3',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--3',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH3',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
      ];
    }
    if (networkId === 'evm--4') {
      return [
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--4',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH4',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
      ];
    }
    if (networkId === 'evm--5') {
      return [
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--5',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH5',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
      ];
    }
    if (networkId === 'evm--6') {
      return [
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--6',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH6',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
      ];
    }
    if (networkId === 'evm--7') {
      return [
        {
          protocol: EExchangeProtocol.SWAP,
          networkId: 'evm--7',
          providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          contractAddress: '0x00000',
          symbol: 'ETH7',
          decimals: 18,
          logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
          swft_coinCode: 'ETH',
          swft_noSupportCoins: 'ETH',
        },
      ];
    }
    return [
      {
        protocol: EExchangeProtocol.SWAP,
        networkId: 'evm--1',
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
        contractAddress: '0x00000',
        symbol: 'ETH',
        decimals: 18,
        logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
        swft_coinCode: 'ETH',
        swft_noSupportCoins: 'ETH',
      },
      {
        protocol: EExchangeProtocol.SWAP,
        networkId: 'evm--2',
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
        contractAddress: '0x00000',
        symbol: 'ETH2',
        decimals: 18,
        logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
        swft_coinCode: 'ETH',
        swft_noSupportCoins: 'ETH',
      },
      {
        protocol: EExchangeProtocol.SWAP,
        networkId: 'evm--3',
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
        contractAddress: '0x00000',
        symbol: 'ETH3',
        decimals: 18,
        logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
        swft_coinCode: 'ETH',
        swft_noSupportCoins: 'ETH',
      },
      {
        protocol: EExchangeProtocol.SWAP,
        networkId: 'evm--4',
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
        contractAddress: '0x00000',
        symbol: 'ETH4',
        decimals: 18,
        logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
        swft_coinCode: 'ETH',
        swft_noSupportCoins: 'ETH',
      },
      {
        protocol: EExchangeProtocol.SWAP,
        networkId: 'evm--5',
        providers: 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
        contractAddress: '0x00000',
        symbol: 'ETH5',
        decimals: 18,
        logoURI: 'https://onekey-asset.s3.amazonaws.com/eth.png',
        swft_coinCode: 'ETH',
        swft_noSupportCoins: 'ETH',
      },
    ];
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
      protocol: EExchangeProtocol.SWAP,
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

    const fetchUrl = `${getFiatEndpoint()}/exchange/swap`;
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
      protocol: EExchangeProtocol.SWAP,
      provider,
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
