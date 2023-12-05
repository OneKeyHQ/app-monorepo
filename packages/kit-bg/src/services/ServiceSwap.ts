import axios from 'axios';

import {
  checkCrossChainProviderIntersection,
  checkSingleChainProviderIntersection,
  filterTokenListByFromToken,
  isOnlySupportSingleChainProvider,
} from '@onekeyhq/kit/src/views/Swap/utils/utils';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getFiatEndpoint } from '@onekeyhq/shared/src/config/endpoint';

import { swapAtom } from '../states/jotai/atoms';

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

export type ISwapNetwork = {
  networkId: string;
  protocolTypes: string;
  providers: string;
};

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
  async fetchSwapNetworks() {
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
      const networks = data.data;
      await swapAtom.set((v) => ({
        ...v,
        fromNetworkList: networks,
        toNetworkList: networks,
      }));
    }
  }

  @backgroundMethod()
  async fetchSwapTokens(type: 'from' | 'to') {
    const {
      SwapNetworkTokensMap: cacheMap,
      fromNetwork,
      fromToken,
      toNetwork,
    } = await swapAtom.get();
    const network = type === 'from' ? fromNetwork : toNetwork;
    if (!network) {
      return;
    }
    if (cacheMap && cacheMap[network.networkId]) {
      let cacheTokens = cacheMap[network.networkId];
      if (type === 'to' && fromToken) {
        cacheTokens = filterTokenListByFromToken(cacheTokens, fromToken);
      }
      const tokensListUpdate =
        type === 'from'
          ? { fromTokenList: cacheTokens }
          : { toTokenList: cacheTokens };

      await swapAtom.set((v) => ({
        ...v,
        ...tokensListUpdate,
      }));
      return;
    }
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
      let tokens = data.data;
      await swapAtom.set((v) => ({
        ...v,
        SwapNetworkTokensMap: { ...cacheMap, [network.networkId]: tokens },
      }));
      if (type === 'to' && fromToken) {
        tokens = filterTokenListByFromToken(tokens, fromToken);
      }
      const tokensListUpdate =
        type === 'from' ? { fromTokenList: tokens } : { toTokenList: tokens };
      await swapAtom.set((v) => ({
        ...v,
        ...tokensListUpdate,
      }));
    }
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

  // ----------- token select
  @backgroundMethod()
  async selectNetwork(network: ISwapNetwork, type: 'from' | 'to') {
    const { fromNetworkList, toNetwork, fromToken, toToken } =
      await swapAtom.get();
    if (type === 'from') {
      const isOnlySupportSingleChain =
        isOnlySupportSingleChainProvider(network);
      await swapAtom.set((v) => ({
        ...v,
        fromNetwork: network,
        isOnlySupportSingleChain,
      }));

      if (isOnlySupportSingleChain) {
        await swapAtom.set((v) => ({ ...v, toNetwork: network }));
      } else if (toNetwork) {
        if (
          !checkCrossChainProviderIntersection(network, toNetwork) &&
          !(
            checkSingleChainProviderIntersection(network, toNetwork) &&
            toNetwork.networkId === network.networkId
          )
        ) {
          await swapAtom.set((v) => ({ ...v, toNetwork: undefined }));
        }
      }
      if (fromNetworkList && fromNetworkList?.length > 0) {
        const newToNetworkList = fromNetworkList.filter(
          (item) =>
            checkCrossChainProviderIntersection(network, item) ||
            (checkSingleChainProviderIntersection(network, item) &&
              item.networkId === network.networkId),
        );
        await swapAtom.set((v) => ({ ...v, toNetworkList: newToNetworkList }));
      }
      if (fromToken) {
        await swapAtom.set((v) => ({ ...v, fromToken: undefined }));
      }
    } else {
      await swapAtom.set((v) => ({ ...v, toNetwork: network }));
      if (toToken) {
        await swapAtom.set((v) => ({ ...v, toToken: undefined }));
      }
    }
    const cleanTokensList =
      type === 'from'
        ? { fromTokenList: undefined }
        : { toTokenList: undefined };
    await swapAtom.set((v) => ({ ...v, ...cleanTokensList }));
  }

  @backgroundMethod()
  async selectToken(token: ISwapToken, type: 'from' | 'to') {
    const { toToken, fromNetwork, toNetwork } = await swapAtom.get();
    const isOnlySupportSingleChain = isOnlySupportSingleChainProvider(token);
    if (type === 'from') {
      await swapAtom.set((v) => ({
        ...v,
        fromToken: token,
        isOnlySupportSingleChain,
      }));
      if (isOnlySupportSingleChain) {
        await swapAtom.set((v) => ({ ...v, toNetwork: fromNetwork }));
        if (
          toToken &&
          (toToken.networkId !== token.networkId ||
            !checkSingleChainProviderIntersection(token, toToken))
        ) {
          await swapAtom.set((v) => ({ ...v, toToken: undefined }));
        }
      } else if (toNetwork) {
        if (
          !checkCrossChainProviderIntersection(token, toNetwork) &&
          !(
            checkSingleChainProviderIntersection(token, toNetwork) &&
            toNetwork.networkId === token.networkId
          )
        ) {
          await swapAtom.set((v) => ({ ...v, toToken: undefined }));
        }
      } else if (toToken) {
        await swapAtom.set((v) => ({ ...v, toToken: undefined }));
      }
    } else {
      await swapAtom.set((v) => ({ ...v, toToken: token }));
    }
  }
}
