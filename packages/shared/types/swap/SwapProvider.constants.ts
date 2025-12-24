import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  EProtocolOfExchange,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

export const swapSlippageItems: {
  key: ESwapSlippageSegmentKey;
  value: ESwapSlippageSegmentKey;
}[] = [
  { key: ESwapSlippageSegmentKey.AUTO, value: ESwapSlippageSegmentKey.AUTO },
  {
    key: ESwapSlippageSegmentKey.CUSTOM,
    value: ESwapSlippageSegmentKey.CUSTOM,
  },
];

export const swapServiceFeeDefault = 0.3;

export const swapSlippageCustomDefaultList = [0.1, 0.5, 1];

export const swapSlippageAutoValue = 0.5;

export const swapSlippageMaxValue = 50;

export const swapSlippageWillFailMinValue = 0.05;

export const swapSlippageWillAheadMinValue = 10;

export const swapSlippage = 50;

export const swapSlippageDecimal = 2;

export const swapTokenCatchMapMaxCount = 30;

export const swapApproveResetValue = '0';

export const swapQuoteIntervalMaxCount = 5;

export const swapQuoteFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 10,
});

export const swapRefreshInterval = timerUtils.getTimeDurationMs({
  seconds: 15,
});

export const swapApprovingStateFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 2,
});

export const swapSpeedSwapApprovingStateFetchInterval =
  timerUtils.getTimeDurationMs({
    seconds: 1,
  });

export const swapHistoryStateFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 3,
});

export const swapHistoryStateFetchRiceIntervalCount = 10;

export const swapQuoteEventTimeout = timerUtils.getTimeDurationMs({
  minute: 5,
});

export const swapNetworksCommonCount = 8;
export const swapNetworksCommonCountMD = 5;

export const swapRateDifferenceMax = -10;
export const swapRateDifferenceMin = 0.05;

export const maxRecentTokenPairs = 10;

export const swapProviderRecommendApprovedWeights = 1.1;

export const limitOrderEstimationFeePercent = 1.05;

export const defaultSupportUrl = 'https://help.onekey.so/articles/11536900';

export const otherWalletFeeData = [
  {
    maxFee: 0.875,
    name: 'metamask',
    color: '#F5841F',
    icon: {
      uri: 'https://uni.onekey-asset.com/static/logo/metamasklogo.png',
    },
    fee: 0.875,
  },
  {
    maxFee: 0.875,
    name: 'phantom',
    fee: 0.85,
    color: '#AB9FF2',

    icon: {
      uri: 'https://uni.onekey-asset.com/static/logo/Phantom.png',
    },
  },
  {
    maxFee: 0.875,
    name: 'zerion',
    fee: 0.8,
    color: '#2461ED',

    icon: {
      uri: 'https://uni.onekey-asset.com/static/logo/zerionlogo.png',
    },
  },
];

export enum ESwapProviderSort {
  RECOMMENDED = 'recommended',
  GAS_FEE = 'gasFee',
  SWAP_DURATION = 'swapDuration',
  RECEIVED = 'received',
}

export enum ESwapProvider {
  Swap1inchFusion = 'Swap1inchFusion',
}

export interface ISwapProviderInfo {
  provider: string;
  protocol: EProtocolOfExchange;
  logo: string;
  providerName: string;
}
export interface ISwapServiceProvider {
  providerInfo: ISwapProviderInfo;
  providerServiceDisable?: boolean;
  isSupportSingleSwap?: boolean;
  isSupportCrossChain?: boolean;
  supportSingleSwapNetworks?: ISwapNetwork[];
  supportCrossChainNetworks?: ISwapNetwork[];
  serviceDisableNetworks?: ISwapNetwork[];
}

export interface ISwapProviderManager {
  providerInfo: ISwapProviderInfo;
  enable: boolean;
  serviceDisable?: boolean;
  supportNetworks?: ISwapNetwork[];
  disableNetworks?: ISwapNetwork[];
  serviceDisableNetworks?: ISwapNetwork[];
}

export const mevSwapNetworks = [
  'evm--1',
  'evm--56',
  'sui--mainnet',
  'evm--8453',
  'sol--101',
];

export const approvingIntervalSecondsDefault = 8;
export const approvingIntervalSecondsEth = 20;

export enum ESwapProTimeRange {
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  EIGHT_HOURS = '8h',
  TWENTY_FOUR_HOURS = '24h',
}
// swap pro
export const swapProTimeRangeItems: {
  label: string;
  value: ESwapProTimeRange;
}[] = [
  { label: '1H', value: ESwapProTimeRange.ONE_HOUR },
  { label: '4H', value: ESwapProTimeRange.FOUR_HOURS },
  { label: '8H', value: ESwapProTimeRange.EIGHT_HOURS },
  { label: '24H', value: ESwapProTimeRange.TWENTY_FOUR_HOURS },
];

export const swapProSellInputSegmentItems = [
  { label: '25%', value: '0.25' },
  { label: '50%', value: '0.5' },
  { label: '75%', value: '0.75' },
  { label: '100%', value: '1' },
];

export const swapProBuyInputSegmentItems = [
  { label: '0.1', value: '0.1' },
  { label: '0.5', value: '0.5' },
  { label: '1', value: '1' },
  { label: '10', value: '10' },
];

export const swapProPositionsListMinValue = 1;
export const swapProPositionsListMaxCount = 20;

export const swapDefaultSetTokens: Record<
  string,
  {
    fromToken?: ISwapToken;
    toToken?: ISwapToken;
    limitFromToken?: ISwapToken;
    limitToToken?: ISwapToken;
  }
> = {
  'onekeyall--0': {
    fromToken: {
      'networkId': 'evm--1',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    toToken: {
      'networkId': 'evm--1',
      'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
  },
  'evm--1': {
    fromToken: {
      'networkId': 'evm--1',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    limitFromToken: {
      'networkId': 'evm--1',
      'contractAddress': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      'name': 'Wrapped Ether',
      'symbol': 'WETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2-1720667871986.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    toToken: {
      'networkId': 'evm--1',
      'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    limitToToken: {
      'networkId': 'evm--1',
      'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
  },
  'evm--56': {
    fromToken: {
      'networkId': 'evm--56',
      'contractAddress': '',
      'name': 'BNB',
      'symbol': 'BNB',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
    toToken: {
      'networkId': 'evm--56',
      'contractAddress': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
  },
  'evm--137': {
    fromToken: {
      'networkId': 'evm--137',
      'contractAddress': '',
      'name': 'Polygon',
      'symbol': 'POL',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--137/tokens/address--1720669850773.png',

      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/polygon.png',
    },
    toToken: {
      'networkId': 'evm--137',
      'contractAddress': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--137/tokens/address-0x3c499c542cef5e3811e1192ce70d8cc03d5c3359.png',

      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/polygon.png',
    },
  },
  'evm--43114': {
    fromToken: {
      'networkId': 'evm--43114',
      'contractAddress': '',
      'name': 'Avalanche',
      'symbol': 'AVAX',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--43114/tokens/address-.png',
      'isNative': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/avalanche.png',
    },
    toToken: {
      'networkId': 'evm--43114',
      'contractAddress': '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--43114/tokens/address-0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e.png',
      'isNative': false,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/avalanche.png',
    },
  },
  'evm--10': {
    fromToken: {
      'networkId': 'evm--10',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--10/tokens/address--1721283262262.png',

      'isNative': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/optimism.png',
    },
    toToken: {
      'networkId': 'evm--10',
      'contractAddress': '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--10/tokens/address-0x0b2c639c533813f4aa9d7837caf62653d097ff85.png',
      'isNative': false,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/optimism.png',
    },
  },
  'evm--42161': {
    fromToken: {
      'networkId': 'evm--42161',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address--1720669989878.png',
      'isNative': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    },
    limitFromToken: {
      'networkId': 'evm--42161',
      'contractAddress': '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      'name': 'Wrapped Ether',
      'symbol': 'WETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0x82af49447d8a07e3bd95bd0d56f35241523fbab1-1720668347864.png',
      'isNative': false,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    },
    toToken: {
      'networkId': 'evm--42161',
      'contractAddress': '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xaf88d065e77c8cc2239327c5edb3a432268e5831.png',
      'isNative': false,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    },
    limitToToken: {
      'networkId': 'evm--42161',
      'contractAddress': '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xaf88d065e77c8cc2239327c5edb3a432268e5831.png',
      'isNative': false,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    },
  },
  'evm--8453': {
    fromToken: {
      'networkId': 'evm--8453',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address--1721283653512.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    },
    limitFromToken: {
      'networkId': 'evm--8453',
      'contractAddress': '0x4200000000000000000000000000000000000006',
      'name': 'Wrapped Ether',
      'symbol': 'WETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-0x4200000000000000000000000000000000000006-1720668314458.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    },
    limitToToken: {
      'networkId': 'evm--8453',
      'contractAddress': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    },
    toToken: {
      'networkId': 'evm--8453',
      'contractAddress': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    },
  },
  'evm--250': {
    fromToken: {
      'networkId': 'evm--250',
      'contractAddress': '',
      'name': 'Fantom',
      'symbol': 'FTM',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--250/tokens/native.png',

      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/fantom.png',
    },
    toToken: {
      'networkId': 'evm--250',
      'contractAddress': '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--250/tokens/0x04068da6c83afcfa0e13ba15a6696662335d5b75.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/fantom.png',
    },
  },
  'evm--324': {
    fromToken: {
      'networkId': 'evm--324',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--324/tokens/native.png',
      'isNative': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/zksync-era-mainnet.png',
    },
    toToken: {
      'networkId': 'evm--324',
      'contractAddress': '0x1d17cbcf0d6d143135ae902365d2e5e2a16538d4',
      'name': 'USDC',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--324/tokens/0x1d17cbcf0d6d143135ae902365d2e5e2a16538d4.png',
      'isNative': false,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/zksync-era-mainnet.png',
    },
  },
  'evm--146': {
    fromToken: {
      'networkId': 'evm--146',
      'contractAddress': '',
      'name': 'Sonic',
      'symbol': 'S',
      'decimals': 18,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--146/tokens/native.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sonic.png',
    },
    toToken: {
      'networkId': 'evm--146',
      'contractAddress': '0x29219dd400f2bf60e5a23d13be72b486d4038894',
      'name': 'Bridged USDC (Sonic Labs)',
      'symbol': 'USDC.e',
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/dashboard/logo/upload_1747214486048.0.9537815416938153.0.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sonic.png',
    },
  },
  'evm--534352': {
    fromToken: {
      'networkId': 'evm--534352',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--534352/tokens/native.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/scr.png',
    },
    toToken: {
      'networkId': 'evm--534352',
      'contractAddress': '0xf55bec9cafdbe8730f096aa55dad6d22d44099df',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--534352/tokens/0xf55bec9cafdbe8730f096aa55dad6d22d44099df.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/scr.png',
    },
  },
  'evm--5000': {
    fromToken: {
      'networkId': 'evm--5000',
      'contractAddress': '',
      'name': 'Mantle',
      'symbol': 'MNT',
      'decimals': 18,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--5000/tokens/native.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/mantle.png',
    },
    toToken: {
      'networkId': 'evm--5000',
      'contractAddress': '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--5000/tokens/0x201eba5cc46d216ce6dc03f6a759e8e766e956ae.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/mantle.png',
    },
  },
  'evm--81457': {
    fromToken: {
      'networkId': 'evm--81457',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--81457/tokens/native.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/logo/blast.png',
    },
    toToken: {
      'networkId': 'evm--81457',
      'contractAddress': '0x4300000000000000000000000000000000000003',
      'name': 'USDB',
      'symbol': 'USDB',
      'decimals': 18,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--81457/tokens/0x4300000000000000000000000000000000000003.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/logo/blast.png',
    },
  },
  'btc--0': {
    fromToken: {
      'networkId': 'btc--0',
      'contractAddress': '',
      'name': 'Bitcoin',
      'symbol': 'BTC',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/btc--0/tokens/address-.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/btc.png',
    },
  },
  'ltc--0': {
    fromToken: {
      'networkId': 'ltc--0',
      'contractAddress': '',
      'name': 'Litecoin',
      'symbol': 'LTC',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/ltc--0/tokens/address-.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/ltc.png',
    },
  },
  'bch--0': {
    fromToken: {
      'networkId': 'bch--0',
      'contractAddress': '',
      'name': 'Bitcoin Cash',
      'symbol': 'BCH',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/bch--0/tokens/address-.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bch.png',
    },
  },
  'doge--0': {
    fromToken: {
      'networkId': 'doge--0',
      'contractAddress': '',
      'name': 'Dogecoin',
      'symbol': 'DOGE',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/doge--0/tokens/address-.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/doge.png',
    },
  },
  'sol--101': {
    fromToken: {
      'networkId': 'sol--101',
      'contractAddress': '',
      'name': 'Solana',
      'symbol': 'SOL',
      'decimals': 9,
      'logoURI':
        'https://uni.onekey-asset.com/dashboard/logo/upload_1723028080499.0.6427884446150325.0.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
    },
    toToken: {
      'networkId': 'sol--101',
      'contractAddress': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'name': 'USDC',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/sol--101/tokens/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
    },
  },
  'xrp--0': {
    fromToken: {
      'networkId': 'xrp--0',
      'contractAddress': '',
      'name': 'Ripple',
      'symbol': 'XRP',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/xrp--0/tokens/native.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/xrp.png',
    },
  },
  'kaspa--kaspa': {
    fromToken: {
      'networkId': 'kaspa--kaspa',
      'contractAddress': '',
      'name': 'Kaspa',
      'symbol': 'KAS',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/kaspa--kaspa/tokens/native.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/kas.png',
    },
  },
  'evm--1030': {
    fromToken: {
      'networkId': 'evm--1030',
      'contractAddress': '',
      'name': 'Conflux eSpace',
      'symbol': 'CFX',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--1030/tokens/native.png',
      'isNative': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/conflux-espace.png',
    },
  },
  'near--0': {
    fromToken: {
      'networkId': 'near--0',
      'contractAddress': '',
      'name': 'Near',
      'symbol': 'NEAR',
      'decimals': 24,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/near--0/tokens/native.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/near.png',
    },
  },
  'tron--0x2b6653dc': {
    fromToken: {
      'networkId': 'tron--0x2b6653dc',
      'contractAddress': '',
      'name': 'Tron',
      'symbol': 'TRX',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/tron--0x2b6653dc/tokens/address--1720669765494.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/tron.png',
    },
    toToken: {
      'networkId': 'tron--0x2b6653dc',
      'contractAddress': 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/tron--0x2b6653dc/tokens/address-TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t-1720668500740.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/tron.png',
    },
  },
  'sui--mainnet': {
    fromToken: {
      'networkId': 'sui--mainnet',
      'contractAddress': '0x2::sui::SUI',
      'name': 'Sui',
      'symbol': 'SUI',
      'decimals': 9,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/sui--mainnet/tokens/0x2::sui::SUI.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sui.png',
    },
    toToken: {
      'networkId': 'sui--mainnet',
      'contractAddress':
        '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
      'name': 'USDC',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/sui--mainnet/tokens/0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sui.png',
    },
  },
  'ton--mainnet': {
    fromToken: {
      'networkId': 'ton--mainnet',
      'contractAddress': '',
      'name': 'Toncoin',
      'symbol': 'TON',
      'decimals': 9,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/ton--mainnet/tokens/native.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/ton.png',
    },
    toToken: {
      'networkId': 'ton--mainnet',
      'contractAddress': 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      'name': 'Tether USD',
      'symbol': 'USD₮',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/ton--mainnet/tokens/EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/ton.png',
    },
  },
  'aptos--1': {
    fromToken: {
      'networkId': 'aptos--1',
      'contractAddress': '0x1::aptos_coin::AptosCoin',
      'name': 'Aptos Coin',
      'symbol': 'APT',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/aptos--1/tokens/0x1::aptos_coin::AptosCoin.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/apt.png',
    },
    toToken: {
      'networkId': 'aptos--1',
      'contractAddress':
        '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b',
      'name': 'USDC',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/aptos--1/tokens/0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/apt.png',
    },
  },
  'evm--59144': {
    fromToken: {
      'networkId': 'evm--59144',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--59144/tokens/native.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/linea.png',
    },
    toToken: {
      'networkId': 'evm--59144',
      'contractAddress': '0x176211869ca2b568f2a7d4ee941e073a821ee1ff',
      'name': 'USDC',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--59144/tokens/0x176211869ca2b568f2a7d4ee941e073a821ee1ff.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/linea.png',
    },
  },
  'evm--196': {
    fromToken: {
      'networkId': 'evm--196',
      'contractAddress': '',
      'name': 'X Layer',
      'symbol': 'OKB',
      'decimals': 18,
      'logoURI': 'https://uni.onekey-asset.com/static/chain/okb.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/okb.png',
    },
    toToken: {
      'networkId': 'evm--196',
      'contractAddress': '0x779ded0c9e1022225f8e0630b35a9b54be713736',
      'name': 'USD₮0',
      'symbol': 'USD₮0',
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--196/tokens/0x779ded0c9e1022225f8e0630b35a9b54be713736.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/okb.png',
    },
  },
};

export const swapPopularTokens: Record<string, ISwapToken[]> = {
  'evm--1': [
    {
      'networkId': 'evm--1',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
      'isNative': true,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    {
      'networkId': 'evm--1',
      'contractAddress': '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    {
      'networkId': 'evm--1',
      'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    {
      'networkId': 'evm--1',
      'contractAddress': '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      'name': 'Wrapped BTC',
      'symbol': 'WBTC',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    {
      'networkId': 'evm--1',
      'contractAddress': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      'name': 'Wrapped Ether',
      'isWrapped': true,
      'symbol': 'WETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2-1720667871986.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    {
      'networkId': 'evm--1',
      'contractAddress': '0x6b175474e89094c44da98b954eedeac495271d0f',
      'name': 'Dai Stablecoin',
      'symbol': 'DAI',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0x6b175474e89094c44da98b954eedeac495271d0f.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
  ],
  'evm--56': [
    {
      'networkId': 'evm--56',
      'contractAddress': '',
      'name': 'BNB',
      'symbol': 'BNB',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-.png',
      'isNative': true,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
    {
      'networkId': 'evm--56',
      'contractAddress': '0x55d398326f99059ff775485246999027b3197955',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-0x55d398326f99059ff775485246999027b3197955-1720668660063.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
    {
      'networkId': 'evm--56',
      'contractAddress': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d-1720669239205.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
    {
      'networkId': 'evm--56',
      'contractAddress': '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      'name': 'Wrapped BNB',
      'symbol': 'WBNB',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
    {
      'networkId': 'evm--56',
      'contractAddress': '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
      'name': 'BTCB Token',
      'symbol': 'BTCB',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
    {
      'networkId': 'evm--56',
      'contractAddress': '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
      'name': 'Dai Token',
      'symbol': 'DAI',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
  ],
  'evm--42161': [
    {
      'networkId': 'evm--42161',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address--1720669989878.png',

      'isNative': true,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    },
    {
      'networkId': 'evm--42161',
      'contractAddress': '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      'name': 'Wrapped Ether',
      'symbol': 'WETH',
      'isWrapped': true,
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0x82af49447d8a07e3bd95bd0d56f35241523fbab1-1720668347864.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    },
    {
      'networkId': 'evm--42161',
      'contractAddress': '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9-1720668746569.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    },
    {
      'networkId': 'evm--42161',
      'contractAddress': '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0xaf88d065e77c8cc2239327c5edb3a432268e5831-1720669320510.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    },
    {
      'networkId': 'evm--42161',
      'contractAddress': '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
      'name': 'Wrapped BTC',
      'symbol': 'WBTC',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/arbitrum.png',
    },
  ],
  'evm--8453': [
    {
      'networkId': 'evm--8453',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address--1721283653512.png',

      'isNative': true,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    },
    {
      'networkId': 'evm--8453',
      'contractAddress': '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913-1720669295958.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    },
    {
      'networkId': 'evm--8453',
      'contractAddress': '0x4200000000000000000000000000000000000006',
      'name': 'Wrapped Ether',
      'symbol': 'WETH',
      'isWrapped': true,
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-0x4200000000000000000000000000000000000006-1720668314458.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    },
    {
      'networkId': 'evm--8453',
      'contractAddress': '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
      'name': 'Dai Stablecoin',
      'symbol': 'DAI',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-0x50c5725949a6f0c72e6c4a641f24049a917db0cb.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    },
    {
      'networkId': 'evm--8453',
      'contractAddress': '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
      'name': 'USD Base Coin',
      'symbol': 'USDbC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/base.png',
    },
  ],
  'evm--137': [
    {
      'networkId': 'evm--137',
      'contractAddress': '',
      'name': 'Polygon',
      'symbol': 'POL',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--137/tokens/address--1720669850773.png',

      'isNative': true,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/polygon.png',
    },
    {
      'networkId': 'evm--137',
      'contractAddress': '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--137/tokens/address-0x3c499c542cef5e3811e1192ce70d8cc03d5c3359-1720669265327.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/polygon.png',
    },
    {
      'networkId': 'evm--137',
      'contractAddress': '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      'name': 'Tether',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--137/tokens/address-0xc2132d05d31c914a87c6611c10748aeb04b58e8f-1720668692077.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/polygon.png',
    },
    {
      'networkId': 'evm--137',
      'contractAddress': '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
      'name': '(PoS) Wrapped BTC',
      'symbol': 'WBTC',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--137/tokens/address-0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/polygon.png',
    },
    {
      'networkId': 'evm--137',
      'contractAddress': '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      'name': 'Wrapped Ether',
      'symbol': 'WETH',
      'isWrapped': true,
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--137/tokens/address-0x7ceb23fd6bc0add59e62ac25578270cff1b9f619-1720668277811.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/polygon.png',
    },
  ],
  'sol--101': [
    {
      'networkId': 'sol--101',
      'contractAddress': '',
      'name': 'Solana',
      'symbol': 'SOL',
      'decimals': 9,
      'logoURI':
        'https://uni.onekey-asset.com/dashboard/logo/upload_1723028080499.0.6427884446150325.0.png',

      'isNative': true,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
    },
    {
      'networkId': 'sol--101',
      'contractAddress': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'name': 'USDC',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/sol--101/tokens/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
    },
    {
      'networkId': 'sol--101',
      'contractAddress': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      'name': 'Tether',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/sol--101/tokens/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
    },
    {
      'networkId': 'sol--101',
      'contractAddress': '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
      'name': 'PayPal USD',
      'symbol': 'PYUSD',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/sol--101/tokens/2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/sol.png',
    },
  ],
  'evm--43114': [
    {
      'networkId': 'evm--43114',
      'contractAddress': '',
      'name': 'Avalanche',
      'symbol': 'AVAX',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--43114/tokens/address-.png',
      'isNative': true,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/avalanche.png',
    },
    {
      'networkId': 'evm--43114',
      'contractAddress': '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--43114/tokens/address-0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e-1720669345050.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/avalanche.png',
    },
    {
      'networkId': 'evm--43114',
      'contractAddress': '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
      'name': 'TetherToken',
      'symbol': 'USDt',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--43114/tokens/address-0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7-1720668785282.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/avalanche.png',
    },
    {
      'networkId': 'evm--43114',
      'contractAddress': '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
      'name': 'Wrapped Ether',
      'symbol': 'WETH.e',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--43114/tokens/address-0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab-1720668375997.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/avalanche.png',
    },
  ],
  'evm--10': [
    {
      'networkId': 'evm--10',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--10/tokens/address--1721283262262.png',

      'isNative': true,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/optimism.png',
    },
    {
      'networkId': 'evm--10',
      'contractAddress': '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--10/tokens/address-0x0b2c639c533813f4aa9d7837caf62653d097ff85-1720669214787.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/optimism.png',
    },
    {
      'networkId': 'evm--10',
      'contractAddress': '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--10/tokens/address-0x94b008aa00579c1307b0ef2c499ad98a8ce58e58-1720668629218.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/optimism.png',
    },
    {
      'networkId': 'evm--10',
      'contractAddress': '0x68f180fcce6836688e9084f035309e29bf0a2095',
      'name': 'Wrapped BTC',
      'symbol': 'WBTC',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--10/tokens/address-0x68f180fcce6836688e9084f035309e29bf0a2095.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/optimism.png',
    },
    {
      'networkId': 'evm--10',
      'contractAddress': '0x4200000000000000000000000000000000000042',
      'name': 'Optimism',
      'symbol': 'OP',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--10/tokens/address-0x4200000000000000000000000000000000000042.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/optimism.png',
    },
  ],
  'evm--250': [
    {
      'networkId': 'evm--250',
      'contractAddress': '',
      'name': 'Fantom',
      'symbol': 'FTM',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--250/tokens/native.png',

      'isNative': true,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/fantom.png',
    },
    {
      'networkId': 'evm--250',
      'contractAddress': '0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e',
      'name': 'Dai Stablecoin',
      'symbol': 'DAI',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--250/tokens/0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/fantom.png',
    },
    {
      'networkId': 'evm--250',
      'contractAddress': '0x321162cd933e2be498cd2267a90534a804051b11',
      'name': 'Bitcoin',
      'symbol': 'BTC',
      'decimals': 8,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--250/tokens/0x321162cd933e2be498cd2267a90534a804051b11.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/fantom.png',
    },
  ],
  'tron--0x2b6653dc': [
    {
      'networkId': 'tron--0x2b6653dc',
      'contractAddress': '',
      'name': 'Tron',
      'symbol': 'TRX',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/tron--0x2b6653dc/tokens/address--1720669765494.png',

      'isNative': true,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/tron.png',
    },
    {
      'networkId': 'tron--0x2b6653dc',
      'contractAddress': 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/tron--0x2b6653dc/tokens/address-TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t-1720668500740.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/tron.png',
    },
    {
      'networkId': 'tron--0x2b6653dc',
      'contractAddress': 'TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4',
      'name': 'TrueUSD',
      'symbol': 'TUSD',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/tron--0x2b6653dc/tokens/address-TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/tron.png',
    },
  ],
  'evm--324': [
    {
      'networkId': 'evm--324',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--324/tokens/native.png',

      'isNative': true,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/zksync-era-mainnet.png',
    },
    {
      'networkId': 'evm--324',
      'contractAddress': '0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4',
      'name': 'Bridged USDC (zkSync)',
      'symbol': 'USDC.e',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--324/tokens/0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/zksync-era-mainnet.png',
    },
    {
      'networkId': 'evm--324',
      'contractAddress': '0x493257fd37edb34451f62edf8d2a0c418852ba4c',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--324/tokens/0x493257fd37edb34451f62edf8d2a0c418852ba4c.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/zksync-era-mainnet.png',
    },
    {
      'networkId': 'evm--324',
      'contractAddress': '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91',
      'name': 'Wrapped Ether',
      'symbol': 'WETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-onchain/evm--324/tokens/0x5aea5775959fbc2557cc8789bc1bf90a239d9a91.png',

      'isNative': false,
      'isPopular': true,
      'networkLogoURI':
        'https://uni.onekey-asset.com/static/chain/zksync-era-mainnet.png',
    },
  ],
  'aptos--1': [
    {
      'networkId': 'aptos--1',
      'contractAddress': '0x1::aptos_coin::AptosCoin',
      'name': 'Aptos Coin',
      'symbol': 'APT',
      'decimals': 8,
      'isPopular': true,
      'logoURI':
        'https://uni-test.onekey-asset.com/dashboard/logo/upload_1762841036401.0.9828413421109685.0.png',
      'isNative': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/apt.png',
    },
    {
      'networkId': 'aptos--1',
      'contractAddress':
        '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b',
      'name': 'Tether USD',
      'symbol': 'USDt',
      'decimals': 6,
      'isPopular': true,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/aptos--1/tokens/0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/apt.png',
    },
    {
      'networkId': 'aptos--1',
      'contractAddress':
        '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b',
      'name': 'USDC',
      'symbol': 'USDC',
      'isPopular': true,
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/aptos--1/tokens/0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b.png',
      'isNative': false,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/apt.png',
    },
  ],
};

export const swapBridgeDefaultTokenMap: Record<string, ISwapToken[]> = {
  'evm--1': [
    {
      'networkId': 'evm--1',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
      'isNative': true,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    {
      'networkId': 'evm--1',
      'contractAddress': '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
    {
      'networkId': 'evm--1',
      'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
  ],
  'evm--56': [],
  'evm--42161': [],
  'evm--137': [],
  'sol--101': [],
  'evm--43114': [],
  'evm--10': [],
};

export const swapBridgeDefaultTokenConfigs = [
  // ETH USDT USDC
  {
    fromTokens: [
      {
        networkId: 'evm--1',
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        isNative: false,
      },
    ],
    toTokenDefaultMatch: {
      'networkId': 'evm--56',
      'contractAddress': '0x55d398326f99059ff775485246999027b3197955',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-0x55d398326f99059ff775485246999027b3197955-1720668660063.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
  },
  {
    fromTokens: [
      {
        networkId: 'evm--1',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        isNative: false,
      },
    ],
    toTokenDefaultMatch: {
      'networkId': 'evm--56',
      'contractAddress': '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d-1720669239205.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
  },
  // USDT
  {
    fromTokens: [
      {
        networkId: 'evm--56',
        contractAddress: '0x55d398326f99059ff775485246999027b3197955',
        isNative: false,
      },
      {
        networkId: 'evm--42161',
        contractAddress: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
        isNative: false,
      },
      {
        networkId: 'evm--137',
        contractAddress: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        isNative: false,
      },
      {
        networkId: 'sol--101',
        contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        isNative: false,
      },
      {
        networkId: 'evm--43114',
        contractAddress: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
        isNative: false,
      },
      {
        networkId: 'evm--10',
        contractAddress: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
        isNative: false,
      },
      {
        networkId: 'tron--0x2b6653dc',
        contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        isNative: false,
      },
      {
        networkId: 'evm--324',
        contractAddress: '0x493257fd37edb34451f62edf8d2a0c418852ba4c',
        isNative: false,
      },
      {
        networkId: 'ton--mainnet',
        contractAddress: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        isNative: false,
      },
    ],
    toTokenDefaultMatch: {
      'networkId': 'evm--1',
      'contractAddress': '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'name': 'Tether USD',
      'symbol': 'USDT',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
  },
  // USDC
  {
    fromTokens: [
      {
        networkId: 'evm--56',
        contractAddress: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        isNative: false,
      },
      {
        networkId: 'evm--42161',
        contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
        isNative: false,
      },
      {
        networkId: 'evm--137',
        contractAddress: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        isNative: false,
      },
      {
        networkId: 'sol--101',
        contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        isNative: false,
      },
      {
        networkId: 'evm--43114',
        contractAddress: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
        isNative: false,
      },
      {
        networkId: 'evm--10',
        contractAddress: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
        isNative: false,
      },
      {
        networkId: 'evm--8453',
        contractAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        isNative: false,
      },
    ],
    toTokenDefaultMatch: {
      'networkId': 'evm--1',
      'contractAddress': '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      'isNative': false,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
    },
  },
];

export const swapBridgeDefaultTokenExtraConfigs = {
  defaultToToken: {
    'networkId': 'evm--1',
    'contractAddress': '',
    'name': 'Ethereum',
    'symbol': 'ETH',
    'decimals': 18,
    'logoURI':
      'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address--1721282106924.png',
    'isNative': true,
    'isPopular': true,
    'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/eth.png',
  },
  mainNetDefaultToTokenConfig: {
    networkId: 'evm--1',
    defaultToToken: {
      'networkId': 'evm--56',
      'contractAddress': '',
      'name': 'BNB',
      'symbol': 'BNB',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--56/tokens/address-.png',
      'isNative': true,
      'isPopular': true,
      'networkLogoURI': 'https://uni.onekey-asset.com/static/chain/bsc.png',
    },
  },
};

export const wrappedTokens = [
  {
    networkId: 'evm--1',
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    logo: 'https://uni.onekey-asset.com/static/logo/WETH.png',
  },
  {
    networkId: 'evm--56',
    address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    logo: 'https://uni.onekey-asset.com/static/logo/wbnb.png',
  },
  {
    networkId: 'evm--137',
    address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    logo: 'https://uni.onekey-asset.com/static/logo/wmatic_provider.png',
  },
  {
    networkId: 'evm--250',
    address: '0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83',
    logo: 'https://uni.onekey-asset.com/static/logo/wftm_provider.png',
  },
  {
    networkId: 'evm--42161',
    address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    logo: 'https://uni.onekey-asset.com/static/logo/WETH.png',
  },
  {
    networkId: 'evm--43114',
    address: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    logo: 'https://uni.onekey-asset.com/static/logo/wavax.png',
  },
  {
    networkId: 'evm--128',
    address: '0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f',
    logo: 'https://uni.onekey-asset.com/static/logo/wht.png',
  },
  {
    networkId: 'evm--66',
    address: '0x8f8526dbfd6e38e3d8307702ca8469bae6c56c15',
    logo: 'https://uni.onekey-asset.com/static/logo/wokt.png',
  },
  {
    networkId: 'evm--10',
    address: '0x4200000000000000000000000000000000000006',
    logo: 'https://uni.onekey-asset.com/static/logo/WETH.png',
  },
  {
    networkId: 'evm--8453',
    address: '0x4200000000000000000000000000000000000006',
    logo: 'https://uni.onekey-asset.com/static/logo/WETH.png',
  },
  {
    networkId: 'evm--324',
    address: '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91',
    logo: 'https://uni.onekey-asset.com/static/logo/WETH.png',
  },
  {
    networkId: 'evm--5000',
    address: '0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8',
    logo: 'https://uni-test.onekey-asset.com/server-service-onchain/evm--5000/tokens/0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8.png',
  },
];
