import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
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

export const swapSlippageCustomDefaultList = [0.1, 0.5, 1];

export const swapSlippageAutoValue = 0.5;

export const swapSlippageMaxValue = 50;

export const swapSlippageWillFailMinValue = 0.05;

export const swapSlippageWillAheadMinValue = 10;

export const swapSlippage = 50;

export const swapSlippageDecimal = 2;

export const networkTransactionExplorerReplaceStr = '{transaction}';

export const swapTokenCatchMapMaxCount = 30;

export const swapApproveResetValue = '0';

export const swapQuoteIntervalMaxCount = 5;

export const swapQuoteFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 10,
});

export const swapApprovingStateFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 1,
});

export const swapHistoryStateFetchInterval = timerUtils.getTimeDurationMs({
  seconds: 3,
});

export const swapNetworksCommonCount = 8;
export const swapNetworksCommonCountMD = 5;

export const swapRateDifferenceMax = -10;
export const swapRateDifferenceMin = 0.05;

export enum ESwapProviderSort {
  RECOMMENDED = 'recommended',
  GAS_FEE = 'gasFee',
  SWAP_DURATION = 'swapDuration',
  RECEIVED = 'received',
}

export const swapDefaultSetTokens: Record<
  string,
  { fromToken?: ISwapToken; toToken?: ISwapToken }
> = {
  'evm--1': {
    fromToken: {
      'networkId': 'evm--1',
      'contractAddress': '',
      'name': 'Ethereum',
      'symbol': 'ETH',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--1/tokens/address-.png',
      'isNative': true,
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
    },
  },
  'evm--137': {
    fromToken: {
      'networkId': 'evm--137',
      'contractAddress': '',
      'name': 'Matic',
      'symbol': 'MATIC',
      'decimals': 18,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--137/tokens/address-.png',

      'isNative': true,
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
    },
    toToken: {
      'networkId': 'evm--43114',
      'contractAddress': '0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664',
      'name': 'USD Coin',
      'symbol': 'USDC.e',
      'decimals': 6,
      'logoURI':
        'https://uni.onekey-asset.com/server-service-indexer/evm--43114/tokens/address-0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664.png',
      'isNative': false,
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
        'https://uni.onekey-asset.com/server-service-indexer/evm--10/tokens/address-.png',

      'isNative': true,
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
        'https://uni.onekey-asset.com/server-service-indexer/evm--42161/tokens/address-.png',
      'isNative': true,
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
        'https://uni.onekey-asset.com/server-service-indexer/evm--8453/tokens/address-.png',
      'isNative': true,
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
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--250/tokens/native.png',

      'isNative': true,
    },
    toToken: {
      'networkId': 'evm--250',
      'contractAddress': '0x04068da6c83afcfa0e13ba15a6696662335d5b75',
      'name': 'USD Coin',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--250/tokens/0x04068da6c83afcfa0e13ba15a6696662335d5b75.png',
      'isNative': false,
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
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--324/tokens/native.png',
      'isNative': true,
    },
    toToken: {
      'networkId': 'evm--324',
      'contractAddress': '0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4',
      'name': 'Bridged USDC (zkSync)',
      'symbol': 'USDC.e',
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/evm--324/tokens/0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4.png',
      'isNative': false,
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
        'https://uni-test.onekey-asset.com/server-service-onchain/sol--101/tokens/native.png',
      'isNative': true,
    },
    toToken: {
      'networkId': 'sol--101',
      'contractAddress': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'name': 'USDC',
      'symbol': 'USDC',
      'decimals': 6,
      'logoURI':
        'https://uni-test.onekey-asset.com/server-service-onchain/sol--101/tokens/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png',
      'isNative': false,
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
        'https://uni-test.onekey-asset.com/server-service-onchain/xrp--0/tokens/native.png',
      'isNative': true,
    },
  },
};
