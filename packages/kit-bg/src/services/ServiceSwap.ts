import axios from 'axios';

import { Toast } from '@onekeyhq/components';
import { CrossChainSwapProviders } from '@onekeyhq/kit/src/views/Swap/config/SwapProvider.constants';
import type {
  ESwapProviders,
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  IFetchQuotesParams,
  IFetchResponse,
  IFetchSwapTxHistoryStatusResponse,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/kit/src/views/Swap/types';
import {
  EExchangeProtocol,
  ESwapTxHistoryStatus,
} from '@onekeyhq/kit/src/views/Swap/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import { getEndpoints } from '../endpoints';

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
    // try {
    //   const { data } = await client.get<IFetchResponse<ISwapNetwork[]>>(
    //     '/exchange/networks',
    //     { params },
    //   );
    //   if (data.code === 0 && data.data) {
    //     console.log('data.data', data.data);
    //     return data.data;
    //   }
    //   Toast.error({ title: 'error', message: data?.message });
    // } catch (e) {
    //   const error = e as { message: string };
    //   Toast.error({ title: 'error', message: error?.message });
    // }
    // return [];
    return [
      {
        'networkId': 'all',
        'protocol': 'swap',
        'name': 'ALL',
        'logoURI': '',
        'symbol': 'all',
        'shortcode': 'all',
      },
      {
        'networkId': 'evm--42220',
        'protocol': 'swap',
        'name': 'Celo',
        'logoURI': 'https://onekey-asset.com/assets/celo/celo.png',
        'symbol': 'CELO',
        'shortcode': 'celo',
        'explorer': 'https://explorer.celo.org/tx/{transaction}',
      },
      {
        'networkId': 'algo--4160',
        'protocol': 'swap',
        'name': 'Algorand',
        'logoURI': 'https://onekey-asset.com/assets/algo/algo.png',
        'symbol': 'ALGO',
        'shortcode': 'algo',
        'explorer': 'https://algoexplorer.io/tx/{transaction}',
      },
      {
        'networkId': 'evm--100',
        'protocol': 'swap',
        'name': 'Gnosis Chain',
        'logoURI': 'https://onekey-asset.com/assets/xdai/gno.png',
        'symbol': 'xDAI',
        'shortcode': 'xdai',
        'explorer': 'https://gnosisscan.io/tx/{transaction}',
      },
      {
        'networkId': 'evm--10',
        'protocol': 'swap',
        'name': 'Optimism',
        'logoURI': 'https://onekey-asset.com/assets/optimism/optimism.png',
        'symbol': 'ETH',
        'shortcode': 'optimism',
        'explorer': 'https://optimistic.etherscan.io/tx/{transaction}',
      },
      {
        'networkId': 'evm--66',
        'protocol': 'swap',
        'name': 'OKX Chain',
        'logoURI': 'https://onekey-asset.com/assets/okt/okt.png',
        'symbol': 'OKT',
        'shortcode': 'okt',
        'explorer': 'https://www.oklink.com/okexchain/tx/{transaction}',
      },
      {
        'networkId': 'evm--128',
        'protocol': 'swap',
        'name': 'Huobi ECO Chain',
        'logoURI': 'https://onekey-asset.com/assets/heco/heco.png',
        'symbol': 'HT',
        'shortcode': 'heco',
        'explorer': 'https://hecoinfo.com/tx/{transaction}',
      },
      {
        'networkId': 'evm--43114',
        'protocol': 'swap',
        'name': 'Avalanche',
        'logoURI': 'https://onekey-asset.com/assets/avalanche/avalanche.png',
        'symbol': 'AVAX',
        'shortcode': 'avalanche',
        'explorer': 'https://cchain.explorer.avax.network/tx/{transaction}',
      },
      {
        'networkId': 'evm--42161',
        'protocol': 'swap',
        'name': 'Arbitrum',
        'logoURI': 'https://onekey-asset.com/assets/arbitrum/arbitrum.png',
        'symbol': 'ETH',
        'shortcode': 'arbitrum',
        'explorer': 'https://arbiscan.io/tx/{transaction}',
      },
      {
        'networkId': 'evm--250',
        'protocol': 'swap',
        'name': 'Fantom',
        'logoURI': 'https://onekey-asset.com/assets/fantom/fantom.png',
        'symbol': 'FTM',
        'shortcode': 'fantom',
        'explorer': 'https://ftmscan.com/tx/{transaction}',
      },
      {
        'networkId': 'evm--137',
        'protocol': 'swap',
        'name': 'Polygon',
        'logoURI': 'https://onekey-asset.com/assets/polygon/polygon.png',
        'symbol': 'MATIC',
        'shortcode': 'polygon',
        'explorer': 'https://polygonscan.com/tx/{transaction}',
      },
      {
        'networkId': 'sol--101',
        'protocol': 'swap',
        'name': 'Solana',
        'logoURI': 'https://onekey-asset.com/assets/sol/sol.png',
        'symbol': 'SOL',
        'shortcode': 'sol',
        'explorer': 'https://explorer.solana.com/tx/{transaction}',
      },
      {
        'networkId': 'evm--56',
        'protocol': 'swap',
        'name': 'BNB Smart Chain',
        'logoURI': 'https://onekey-asset.com/assets/bsc/bsc.png',
        'symbol': 'BNB',
        'shortcode': 'bsc',
        'explorer': 'https://bscscan.com/tx/{transaction}',
      },
      {
        'networkId': 'btc--0',
        'protocol': 'swap',
        'name': 'Bitcoin',
        'logoURI': 'https://onekey-asset.com/assets/btc/btc.png',
        'symbol': 'BTC',
        'shortcode': 'btc',
        'explorer': 'https://mempool.space/tx/{transaction}',
      },
      {
        'networkId': 'evm--1',
        'protocol': 'swap',
        'name': 'Ethereum',
        'logoURI': 'https://onekey-asset.com/assets/eth/eth.png',
        'symbol': 'ETH',
        'shortcode': 'eth',
        'explorer': 'https://cn.etherscan.com/tx/{transaction}',
      },
      {
        'networkId': 'evm--324',
        'protocol': 'swap',
        'name': 'zkSync Era Mainnet',
        'logoURI': 'https://onekey-asset.com/assets/zksyncera/zksyncera.png',
        'symbol': 'ETH',
        'shortcode': 'zksyncera',
        'explorer': 'https://explorer.zksync.io/tx/{transaction}',
      },
      {
        'networkId': 'tron--0x2b6653dc',
        'protocol': 'swap',
        'name': 'Tron',
        'logoURI': 'https://onekey-asset.com/assets/trx/trx.png',
        'symbol': 'TRX',
        'shortcode': 'trx',
        'explorer': 'https://tronscan.org/#/transaction/{transaction}',
      },
      {
        'networkId': 'xrp--0',
        'protocol': 'swap',
        'name': 'Ripple',
        'logoURI': 'https://common.onekey-asset.com/chain/xrp.png',
        'symbol': 'XRP',
        'shortcode': 'xrp',
        'explorer': 'https://xrpscan.com/tx/{transaction}',
      },
      {
        'networkId': 'dot--polkadot',
        'protocol': 'swap',
        'name': 'Polkadot',
        'logoURI': 'https://onekey-asset.com/assets/polkadot/polkadot.png',
        'symbol': 'DOT',
        'shortcode': 'dot',
        'explorer': 'https://polkadot.subscan.io/extrinsic/{transaction}',
      },
      {
        'networkId': 'near--0',
        'protocol': 'swap',
        'name': 'Near',
        'logoURI': 'https://onekey-asset.com/assets/near/near.png',
        'symbol': 'NEAR',
        'shortcode': 'near',
        'explorer':
          'https://explorer.mainnet.near.org/transactions/{transaction}',
      },
      {
        'networkId': 'ltc--0',
        'protocol': 'swap',
        'name': 'Litecoin',
        'logoURI': 'https://common.onekey-asset.com/chain/ltc.png',
        'symbol': 'LTC',
        'shortcode': 'ltc',
        'explorer': 'https://litecoinblockexplorer.net/tx/{transaction}',
      },
      {
        'networkId': 'evm--59144',
        'protocol': 'swap',
        'name': 'Linea',
        'logoURI': 'https://onekey-asset.com/assets/linea/linea.png',
        'symbol': 'ETH',
        'shortcode': 'linea',
        'explorer': 'https://lineascan.build/tx/{transaction}',
      },
      {
        'networkId': 'fil--314',
        'protocol': 'swap',
        'name': 'Filecoin',
        'logoURI': 'https://onekey-asset.com/assets/fil/fil.png',
        'symbol': 'FIL',
        'shortcode': 'fil',
        'explorer':
          'https://filscan.io/tipset/message-detail?cid={transaction}',
      },
      {
        'networkId': 'evm--10001',
        'protocol': 'swap',
        'name': 'EthereumPoW',
        'logoURI': 'https://onekey-asset.com/assets/ethw/ethw.png',
        'symbol': 'ETHW',
        'shortcode': 'ethw',
        'explorer': 'https://www.oklink.com/ethw/tx/{transaction}',
      },
      {
        'networkId': 'evm--5',
        'protocol': 'swap',
        'name': 'Ethereum Görli (Goerli) Testnet',
        'logoURI': 'https://onekey-asset.com/assets/teth/teth.png',
        'symbol': 'TETH',
        'shortcode': 'goerli',
        'explorer': 'https://goerli.etherscan.io/tx/{transaction}',
      },
      {
        'networkId': 'evm--513100',
        'protocol': 'swap',
        'name': 'Ethereum Fair',
        'logoURI': 'https://onekey-asset.com/assets/etf/etf.png',
        'symbol': 'ETHF',
        'shortcode': 'etf',
        'explorer': 'https://explorer.etherfair.org/tx/{transaction}',
      },
      {
        'networkId': 'evm--61',
        'protocol': 'swap',
        'name': 'Ethereum Classic',
        'logoURI': 'https://onekey-asset.com/assets/etc/etc.png',
        'symbol': 'ETC',
        'shortcode': 'etc',
        'explorer': 'https://blockscout.com/etc/mainnet/tx/{transaction}',
      },
      {
        'networkId': 'doge--0',
        'protocol': 'swap',
        'name': 'Dogecoin',
        'logoURI': 'https://onekey-asset.com/assets/doge/doge.png',
        'symbol': 'DOGE',
        'shortcode': 'doge',
        'explorer': 'https://dogeblocks.com/tx/{transaction}',
      },
      {
        'networkId': 'cosmos--cosmoshub-4',
        'protocol': 'swap',
        'name': 'Cosmos',
        'logoURI': 'https://onekey-asset.com/assets/cosmos/cosmos.png',
        'symbol': 'ATOM',
        'shortcode': 'cosmoshub',
        'explorer': 'https://www.mintscan.io/cosmos/txs/{transaction}',
      },
      {
        'networkId': 'evm--1030',
        'protocol': 'swap',
        'name': 'Conflux eSpace',
        'logoURI': 'https://onekey-asset.com/assets/cfx/cfx.png',
        'symbol': 'CFX',
        'shortcode': 'cfxespace',
        'explorer': 'https://evm.confluxscan.net/tx/{transaction}',
      },
      {
        'networkId': 'ada--0',
        'protocol': 'swap',
        'name': 'Cardano',
        'logoURI': 'https://onekey-asset.com/assets/ada/ada.png',
        'symbol': 'ADA',
        'shortcode': 'ada',
        'explorer': 'https://cardanoscan.io/transaction/{transaction}',
      },
      {
        'networkId': 'bch--0',
        'protocol': 'swap',
        'name': 'Bitcoin Cash',
        'logoURI': 'https://common.onekey-asset.com/chain/bch.png',
        'symbol': 'BCH',
        'shortcode': 'bch',
        'explorer': 'https://bchblockexplorer.com/tx/{transaction}',
      },
      {
        'networkId': 'evm--8453',
        'protocol': 'swap',
        'name': 'Base',
        'logoURI': 'https://onekey-asset.com/assets/base/base.png',
        'symbol': 'ETH',
        'shortcode': 'base',
        'explorer': 'https://basescan.org/tx/{transaction}',
      },
      {
        'networkId': 'evm--1313161554',
        'protocol': 'swap',
        'name': 'Aurora',
        'logoURI': 'https://onekey-asset.com/assets/aurora/aurora.png',
        'symbol': 'ETH',
        'shortcode': 'aurora',
        'explorer': 'https://aurorascan.dev/tx/{transaction}',
      },
      {
        'networkId': 'aptos--1',
        'protocol': 'swap',
        'name': 'Aptos',
        'logoURI': 'https://onekey-asset.com/assets/apt/apt.png',
        'symbol': 'APT',
        'shortcode': 'apt',
        'explorer':
          'https://explorer.aptoslabs.com/txn/{transaction}/?network=mainnet',
      },
    ];
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
  }: {
    type: 'from' | 'to';
    networkId?: string;
    keywords?: string;
    fromToken?: ISwapToken;
    limit?: number;
    next?: string;
    accountAddress?: string;
    accountNetworkId?: string;
    accountXpub?: string;
  }): Promise<{ result: ISwapToken[]; next?: string }> {
    // if (this._tokensCancelSource) {
    //   this._tokensCancelSource.cancel('tokens request canceled');
    // }
    // const providersArr = fromToken?.providers.split(',');
    // const params = {
    //   fromTokenNetworkId: fromToken?.networkId,
    //   fromTokenProviders: fromToken?.providers,
    //   fromTokenAddress: fromToken?.contractAddress,
    //   protocol: EExchangeProtocol.SWAP,
    //   networkId: networkId === 'all' ? undefined : networkId,
    //   keywords,
    //   fromTokenSwapSwftUnSupportCode: providersArr?.every(
    //     (item) => item === ESwapProviders.SWFT,
    //   )
    //     ? fromToken?.swapSwftUnSupportCode
    //     : undefined,
    //   type,
    //   limit,
    //   next,
    //   accountAddress,
    //   accountNetworkId,
    //   accountXpub,
    // };
    // this._tokensCancelSource = axios.CancelToken.source();
    // const endpoints = await getEndpoints();
    // const fetchUrl = `${endpoints.http}/exchange/tokens`;
    // // const client = await this.getClient();
    // try {
    //   const { data } = await axios.get<
    //     IFetchResponse<{ next?: string; data: ISwapToken[] }>
    //   >(fetchUrl, {
    //     params,
    //     cancelToken: this._tokensCancelSource.token,
    //     baseURL: endpoints.http,
    //   });
    //   if (data?.code === 0 && data?.data) {
    //     console.log('data.data.data', data.data.data);
    //     return { result: data.data.data, next: data.data.next };
    //   }
    //   Toast.error({ title: 'error', message: data?.message });
    // } catch (e) {
    //   if (axios.isCancel(e)) {
    //     throw new Error('cancel');
    //   } else {
    //     const error = e as { message: string };
    //     Toast.error({ title: 'error', message: error?.message });
    //     return { result: [], next: undefined };
    //   }
    // } finally {
    //   this._tokensCancelSource = undefined;
    // }
    // return { result: [], next: undefined };
    return {
      result: [
        {
          'networkId': 'evm--1',
          'providers': 'swap_1inch,swap_0x,swap_swft,swap_socket_bridge',
          'protocol': 'swap',
          'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          'symbol': 'USDC',
          'decimals': 6,
          'name': 'USD Coin',
          'logoURI':
            'https://common.onekey-asset.com/token/evm-1/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48.jpg',
          'swapSwftCode': 'USDC',
          'swapSwftUnSupportCode':
            'MDS,XMR,SKM,GLM,DX,BUY,BTRST,RARI,MUSE,BSMV,USDC',
          'balance': '1000000',
          'balanceParsed': '1',
          'price': 1.001,
          'price24h': -0.03792291869021284,
          'fiatValue': '1.001',
        },
        {
          'networkId': 'evm--1',
          'providers': 'swap_1inch,swap_0x,swap_socket_bridge',
          'protocol': 'swap',
          'contractAddress': '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0',
          'symbol': 'MATIC',
          'decimals': 18,
          'name': 'Polygon',
          'logoURI':
            'https://common.onekey-asset.com/token/evm-1/0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0.jpg',
          'balance': '859032355513342312',
          'balanceParsed': '0.859032',
          'price': 0.823489,
          'price24h': 5.561250197614799,
          'fiatValue': '0.707403',
        },
        {
          'networkId': 'evm--1',
          'providers': 'swap_1inch,swap_0x,swap_socket_bridge',
          'protocol': 'swap',
          'contractAddress': '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
          'symbol': 'stETH',
          'decimals': 18,
          'name': 'Liquid staked Ether 2.0',
          'logoURI':
            'https://common.onekey-asset.com/token/evm-1/0xae7ab96520de3a18e5e111b5eaab095312d7fe84.png',
          'balance': '1',
          'balanceParsed': '0',
          'price': 2306.74,
          'price24h': 3.5176532557313704,
          'fiatValue': '0',
        },
        {
          'networkId': 'tron--0x2b6653dc',
          'providers': 'swap_swft',
          'protocol': 'swap',
          'contractAddress': 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          'symbol': 'USDT',
          'decimals': 6,
          'name': 'Tether',
          'logoURI':
            'https://common.onekey-asset.com/token/evm-1/0xdAC17F958D2ee523a2206206994597C13D831ec7.jpg',
          'swapSwftCode': 'USDT(TRON)',
          'swapSwftUnSupportCode':
            'MDS,SKM,DX,BUY,BTRST,RARI,MUSE,BSMV,USDT(TRON)',
          'balance': '',
          'balanceParsed': '',
          'price': 1.001,
          'price24h': 0.05876839951161751,
          'fiatValue': '',
        },
      ],
    };
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
    const endpoints = await getEndpoints();
    const fetchUrl = `${endpoints.http}/exchange/quote`;
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
    try {
      const { data } = await client.get<IFetchResponse<IFetchBuildTxResponse>>(
        '/exchange/build_tx',
        { params },
      );
      if (data.code === 0 && data.data) {
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
    ctx,
  }: {
    txId: string;
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
    };
    const client = await this.getClient();
    try {
      const { data } = await client.post<
        IFetchResponse<IFetchSwapTxHistoryStatusResponse>
      >('/exchange/state_tx', params);
      if (data?.code === 0 && data?.data) {
        return data.data;
      }
      Toast.error({ title: 'error', message: data?.message });
    } catch (e) {
      const error = e as { message: string };
      Toast.error({ title: 'error', message: error?.message });
    }
    return { state: ESwapTxHistoryStatus.FAILED };
  }
}
