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

export const privateSendHelpCenterUrl =
  'https://help.onekey.so/articles/15388307';

export const privateSendProvider = 'SwapRocketXPrivateSend';

export const privateSendFallbackOrderIdPrefix = 'private-send-';

const ONEKEY_ASSET_BASE_URL = 'https://uni.onekey-asset.com';
const ONEKEY_ASSET_TEST_BASE_URL = 'https://uni-test.onekey-asset.com';

function getOneKeyAssetUrl(path: string, useTestHost = false) {
  return `${useTestHost ? ONEKEY_ASSET_TEST_BASE_URL : ONEKEY_ASSET_BASE_URL}/${path}`;
}

function getChainLogoURI(name: string) {
  return getOneKeyAssetUrl(`static/chain/${name}.png`);
}

function getStaticLogoURI(name: string) {
  return getOneKeyAssetUrl(`static/logo/${name}.png`);
}

function getDashboardLogoURI(name: string, useTestHost = false) {
  return getOneKeyAssetUrl(`dashboard/logo/${name}`, useTestHost);
}

function getIndexerTokenLogoURI(
  networkId: string,
  filename: string,
  useTestHost = false,
) {
  return getOneKeyAssetUrl(
    `server-service-indexer/${networkId}/tokens/${filename}`,
    useTestHost,
  );
}

function getOnChainTokenLogoURI(
  networkId: string,
  filename: string,
  useTestHost = false,
) {
  return getOneKeyAssetUrl(
    `server-service-onchain/${networkId}/tokens/${filename}`,
    useTestHost,
  );
}

function getSwapToken(
  networkId: string,
  contractAddress: string,
  name: string,
  symbol: string,
  decimals: number,
  logoURI: string,
  isNative: boolean,
  networkLogoURI: string,
  extra?: Pick<ISwapToken, 'isPopular' | 'isWrapped'>,
): ISwapToken {
  return {
    networkId,
    contractAddress,
    name,
    symbol,
    decimals,
    logoURI,
    isNative,
    networkLogoURI,
    ...extra,
  };
}

function getIndexerSwapToken(
  networkId: string,
  contractAddress: string,
  name: string,
  symbol: string,
  decimals: number,
  logoFilename: string,
  isNative: boolean,
  chainLogoName: string,
  extra?: Pick<ISwapToken, 'isPopular' | 'isWrapped'>,
  useTestHost = false,
) {
  return getSwapToken(
    networkId,
    contractAddress,
    name,
    symbol,
    decimals,
    getIndexerTokenLogoURI(networkId, logoFilename, useTestHost),
    isNative,
    getChainLogoURI(chainLogoName),
    extra,
  );
}

function getOnChainSwapToken(
  networkId: string,
  contractAddress: string,
  name: string,
  symbol: string,
  decimals: number,
  logoFilename: string,
  isNative: boolean,
  chainLogoName: string,
  extra?: Pick<ISwapToken, 'isPopular' | 'isWrapped'>,
  useTestHost = false,
) {
  return getSwapToken(
    networkId,
    contractAddress,
    name,
    symbol,
    decimals,
    getOnChainTokenLogoURI(networkId, logoFilename, useTestHost),
    isNative,
    getChainLogoURI(chainLogoName),
    extra,
  );
}

function getDashboardSwapToken(
  networkId: string,
  contractAddress: string,
  name: string,
  symbol: string,
  decimals: number,
  logoFilename: string,
  isNative: boolean,
  chainLogoName: string,
  extra?: Pick<ISwapToken, 'isPopular' | 'isWrapped'>,
  useTestHost = false,
) {
  return getSwapToken(
    networkId,
    contractAddress,
    name,
    symbol,
    decimals,
    getDashboardLogoURI(logoFilename, useTestHost),
    isNative,
    getChainLogoURI(chainLogoName),
    extra,
  );
}

export const otherWalletFeeData = [
  {
    maxFee: 0.875,
    name: 'metamask',
    color: '#F5841F',
    icon: {
      uri: getStaticLogoURI('metamasklogo'),
    },
    fee: 0.875,
  },
  {
    maxFee: 0.875,
    name: 'phantom',
    fee: 0.85,
    color: '#AB9FF2',

    icon: {
      uri: getStaticLogoURI('Phantom'),
    },
  },
  {
    maxFee: 0.875,
    name: 'zerion',
    fee: 0.8,
    color: '#2461ED',

    icon: {
      uri: getStaticLogoURI('zerionlogo'),
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
  isSupportSingleSwap?: boolean;
  isSupportCrossChain?: boolean;
  singleSwapEnable?: boolean;
  crossChainEnable?: boolean;
  supportSingleSwapNetworks?: ISwapNetwork[];
  supportCrossChainNetworks?: ISwapNetwork[];
  supportNetworks?: ISwapNetwork[];
  disableNetworks?: ISwapNetwork[];
  singleSwapDisableNetworks?: ISwapNetwork[];
  crossChainDisableNetworks?: ISwapNetwork[];
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
// Stock positions use a lower floor so small (but non-dust) stock holdings show.
export const swapProStockPositionsListMinValue = 0.1;

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
    fromToken: getIndexerSwapToken(
      'evm--1',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1721282106924.png',
      true,
      'eth',
    ),
    toToken: getIndexerSwapToken(
      'evm--1',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'USD Coin',
      'USDC',
      6,
      'address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      false,
      'eth',
    ),
  },
  'evm--1': {
    fromToken: getIndexerSwapToken(
      'evm--1',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1721282106924.png',
      true,
      'eth',
    ),
    limitFromToken: getIndexerSwapToken(
      'evm--1',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      'Wrapped Ether',
      'WETH',
      18,
      'address-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2-1720667871986.png',
      false,
      'eth',
    ),
    toToken: getIndexerSwapToken(
      'evm--1',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'USD Coin',
      'USDC',
      6,
      'address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      false,
      'eth',
    ),
    limitToToken: getIndexerSwapToken(
      'evm--1',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'USD Coin',
      'USDC',
      6,
      'address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      false,
      'eth',
    ),
  },
  'evm--56': {
    fromToken: getIndexerSwapToken(
      'evm--56',
      '',
      'BNB',
      'BNB',
      18,
      'address-.png',
      true,
      'bsc',
    ),
    toToken: getIndexerSwapToken(
      'evm--56',
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      'USD Coin',
      'USDC',
      18,
      'address-0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d.png',
      false,
      'bsc',
    ),
  },
  'evm--137': {
    fromToken: getIndexerSwapToken(
      'evm--137',
      '',
      'Polygon',
      'POL',
      18,
      'address--1720669850773.png',
      true,
      'polygon',
    ),
    toToken: getIndexerSwapToken(
      'evm--137',
      '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      'USD Coin',
      'USDC',
      6,
      'address-0x3c499c542cef5e3811e1192ce70d8cc03d5c3359.png',
      false,
      'polygon',
    ),
  },
  'evm--43114': {
    fromToken: getIndexerSwapToken(
      'evm--43114',
      '',
      'Avalanche',
      'AVAX',
      18,
      'address-.png',
      true,
      'avalanche',
    ),
    toToken: getIndexerSwapToken(
      'evm--43114',
      '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
      'USD Coin',
      'USDC',
      6,
      'address-0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e.png',
      false,
      'avalanche',
    ),
  },
  'evm--10': {
    fromToken: getIndexerSwapToken(
      'evm--10',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1721283262262.png',
      true,
      'optimism',
    ),
    toToken: getIndexerSwapToken(
      'evm--10',
      '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
      'USD Coin',
      'USDC',
      6,
      'address-0x0b2c639c533813f4aa9d7837caf62653d097ff85.png',
      false,
      'optimism',
    ),
  },
  'evm--42161': {
    fromToken: getIndexerSwapToken(
      'evm--42161',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1720669989878.png',
      true,
      'arbitrum',
    ),
    limitFromToken: getIndexerSwapToken(
      'evm--42161',
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      'Wrapped Ether',
      'WETH',
      18,
      'address-0x82af49447d8a07e3bd95bd0d56f35241523fbab1-1720668347864.png',
      false,
      'arbitrum',
    ),
    toToken: getIndexerSwapToken(
      'evm--42161',
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      'USD Coin',
      'USDC',
      6,
      'address-0xaf88d065e77c8cc2239327c5edb3a432268e5831.png',
      false,
      'arbitrum',
    ),
    limitToToken: getIndexerSwapToken(
      'evm--42161',
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      'USD Coin',
      'USDC',
      6,
      'address-0xaf88d065e77c8cc2239327c5edb3a432268e5831.png',
      false,
      'arbitrum',
    ),
  },
  'evm--8453': {
    fromToken: getIndexerSwapToken(
      'evm--8453',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1721283653512.png',
      true,
      'base',
    ),
    limitFromToken: getIndexerSwapToken(
      'evm--8453',
      '0x4200000000000000000000000000000000000006',
      'Wrapped Ether',
      'WETH',
      18,
      'address-0x4200000000000000000000000000000000000006-1720668314458.png',
      false,
      'base',
    ),
    limitToToken: getIndexerSwapToken(
      'evm--8453',
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      'USD Coin',
      'USDC',
      6,
      'address-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.png',
      false,
      'base',
    ),
    toToken: getIndexerSwapToken(
      'evm--8453',
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      'USD Coin',
      'USDC',
      6,
      'address-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.png',
      false,
      'base',
    ),
  },
  'evm--324': {
    fromToken: getOnChainSwapToken(
      'evm--324',
      '',
      'Ethereum',
      'ETH',
      18,
      'native.png',
      true,
      'zksync-era-mainnet',
    ),
    toToken: getOnChainSwapToken(
      'evm--324',
      '0x1d17cbcf0d6d143135ae902365d2e5e2a16538d4',
      'USDC',
      'USDC',
      6,
      '0x1d17cbcf0d6d143135ae902365d2e5e2a16538d4.png',
      false,
      'zksync-era-mainnet',
    ),
  },
  'evm--146': {
    fromToken: getOnChainSwapToken(
      'evm--146',
      '',
      'Sonic',
      'S',
      18,
      'native.png',
      true,
      'sonic',
      undefined,
      true,
    ),
    toToken: getDashboardSwapToken(
      'evm--146',
      '0x29219dd400f2bf60e5a23d13be72b486d4038894',
      'Bridged USDC (Sonic Labs)',
      'USDC.e',
      6,
      'upload_1747214486048.0.9537815416938153.0.png',
      false,
      'sonic',
      undefined,
      true,
    ),
  },
  'evm--534352': {
    fromToken: getOnChainSwapToken(
      'evm--534352',
      '',
      'Ethereum',
      'ETH',
      18,
      'native.png',
      true,
      'scr',
      undefined,
      true,
    ),
    toToken: getOnChainSwapToken(
      'evm--534352',
      '0xf55bec9cafdbe8730f096aa55dad6d22d44099df',
      'Tether USD',
      'USDT',
      6,
      '0xf55bec9cafdbe8730f096aa55dad6d22d44099df.png',
      false,
      'scr',
      undefined,
      true,
    ),
  },
  'evm--5000': {
    fromToken: getOnChainSwapToken(
      'evm--5000',
      '',
      'Mantle',
      'MNT',
      18,
      'native.png',
      true,
      'mantle',
      undefined,
      true,
    ),
    toToken: getOnChainSwapToken(
      'evm--5000',
      '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae',
      'Tether USD',
      'USDT',
      6,
      '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae.png',
      false,
      'mantle',
      undefined,
      true,
    ),
  },
  'evm--81457': {
    fromToken: getSwapToken(
      'evm--81457',
      '',
      'Ethereum',
      'ETH',
      18,
      getOnChainTokenLogoURI('evm--81457', 'native.png', true),
      true,
      getStaticLogoURI('blast'),
    ),
    toToken: getSwapToken(
      'evm--81457',
      '0x4300000000000000000000000000000000000003',
      'USDB',
      'USDB',
      18,
      getOnChainTokenLogoURI(
        'evm--81457',
        '0x4300000000000000000000000000000000000003.png',
        true,
      ),
      false,
      getStaticLogoURI('blast'),
    ),
  },
  'btc--0': {
    fromToken: getIndexerSwapToken(
      'btc--0',
      '',
      'Bitcoin',
      'BTC',
      8,
      'address-.png',
      true,
      'btc',
    ),
  },
  'ltc--0': {
    fromToken: getIndexerSwapToken(
      'ltc--0',
      '',
      'Litecoin',
      'LTC',
      8,
      'address-.png',
      true,
      'ltc',
    ),
  },
  'bch--0': {
    fromToken: getIndexerSwapToken(
      'bch--0',
      '',
      'Bitcoin Cash',
      'BCH',
      8,
      'address-.png',
      true,
      'bch',
    ),
  },
  'doge--0': {
    fromToken: getIndexerSwapToken(
      'doge--0',
      '',
      'Dogecoin',
      'DOGE',
      8,
      'address-.png',
      true,
      'doge',
    ),
  },
  'sol--101': {
    fromToken: getDashboardSwapToken(
      'sol--101',
      '',
      'Solana',
      'SOL',
      9,
      'upload_1723028080499.0.6427884446150325.0.png',
      true,
      'sol',
    ),
    toToken: getOnChainSwapToken(
      'sol--101',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'USDC',
      'USDC',
      6,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png',
      false,
      'sol',
    ),
  },
  'xrp--0': {
    fromToken: getOnChainSwapToken(
      'xrp--0',
      '',
      'XRP Ledger',
      'XRP',
      6,
      'native.png',
      true,
      'xrp',
    ),
  },
  'kaspa--kaspa': {
    fromToken: getOnChainSwapToken(
      'kaspa--kaspa',
      '',
      'Kaspa',
      'KAS',
      8,
      'native.png',
      true,
      'kas',
    ),
  },
  'evm--1030': {
    fromToken: getOnChainSwapToken(
      'evm--1030',
      '',
      'Conflux eSpace',
      'CFX',
      18,
      'native.png',
      true,
      'conflux-espace',
    ),
  },
  'near--0': {
    fromToken: getOnChainSwapToken(
      'near--0',
      '',
      'Near',
      'NEAR',
      24,
      'native.png',
      true,
      'near',
    ),
  },
  'tron--0x2b6653dc': {
    fromToken: getIndexerSwapToken(
      'tron--0x2b6653dc',
      '',
      'Tron',
      'TRX',
      6,
      'address--1720669765494.png',
      true,
      'tron',
    ),
    toToken: getIndexerSwapToken(
      'tron--0x2b6653dc',
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      'Tether USD',
      'USDT',
      6,
      'address-TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t-1720668500740.png',
      false,
      'tron',
    ),
  },
  'sui--mainnet': {
    fromToken: getOnChainSwapToken(
      'sui--mainnet',
      '0x2::sui::SUI',
      'Sui',
      'SUI',
      9,
      '0x2::sui::SUI.png',
      true,
      'sui',
    ),
    toToken: getOnChainSwapToken(
      'sui--mainnet',
      '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
      'USDC',
      'USDC',
      6,
      '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC.png',
      false,
      'sui',
    ),
  },
  'ton--mainnet': {
    fromToken: getOnChainSwapToken(
      'ton--mainnet',
      '',
      'Toncoin',
      'TON',
      9,
      'native.png',
      true,
      'ton',
    ),
    toToken: getOnChainSwapToken(
      'ton--mainnet',
      'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
      'Tether USD',
      'USD₮',
      6,
      'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs.png',
      false,
      'ton',
    ),
  },
  'aptos--1': {
    fromToken: getOnChainSwapToken(
      'aptos--1',
      '0x1::aptos_coin::AptosCoin',
      'Aptos Coin',
      'APT',
      8,
      '0x1::aptos_coin::AptosCoin.png',
      true,
      'apt',
    ),
    toToken: getOnChainSwapToken(
      'aptos--1',
      '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b',
      'USDC',
      'USDC',
      6,
      '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b.png',
      false,
      'apt',
      undefined,
      true,
    ),
  },
  'evm--59144': {
    fromToken: getOnChainSwapToken(
      'evm--59144',
      '',
      'Ethereum',
      'ETH',
      18,
      'native.png',
      true,
      'linea',
      undefined,
      true,
    ),
    toToken: getOnChainSwapToken(
      'evm--59144',
      '0x176211869ca2b568f2a7d4ee941e073a821ee1ff',
      'USDC',
      'USDC',
      6,
      '0x176211869ca2b568f2a7d4ee941e073a821ee1ff.png',
      false,
      'linea',
      undefined,
      true,
    ),
  },
  'evm--196': {
    fromToken: getSwapToken(
      'evm--196',
      '',
      'X Layer',
      'OKB',
      18,
      getChainLogoURI('okb'),
      true,
      getChainLogoURI('okb'),
    ),
    toToken: getOnChainSwapToken(
      'evm--196',
      '0x779ded0c9e1022225f8e0630b35a9b54be713736',
      'USD₮0',
      'USD₮0',
      6,
      '0x779ded0c9e1022225f8e0630b35a9b54be713736.png',
      false,
      'okb',
      undefined,
      true,
    ),
  },
};

export const swapPopularTokens: Record<string, ISwapToken[]> = {
  'evm--1': [
    getIndexerSwapToken(
      'evm--1',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1721282106924.png',
      true,
      'eth',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--1',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'Tether USD',
      'USDT',
      6,
      'address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png',
      false,
      'eth',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--1',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'USD Coin',
      'USDC',
      6,
      'address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      false,
      'eth',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--1',
      '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
      'Wrapped BTC',
      'WBTC',
      8,
      'address-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599.png',
      false,
      'eth',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--1',
      '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      'Wrapped Ether',
      'WETH',
      18,
      'address-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2-1720667871986.png',
      false,
      'eth',
      { isPopular: true, isWrapped: true },
    ),
    getIndexerSwapToken(
      'evm--1',
      '0x6b175474e89094c44da98b954eedeac495271d0f',
      'Dai Stablecoin',
      'DAI',
      18,
      'address-0x6b175474e89094c44da98b954eedeac495271d0f.png',
      false,
      'eth',
      { isPopular: true },
    ),
  ],
  'evm--56': [
    getIndexerSwapToken(
      'evm--56',
      '',
      'BNB',
      'BNB',
      18,
      'address-.png',
      true,
      'bsc',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--56',
      '0x55d398326f99059ff775485246999027b3197955',
      'Tether USD',
      'USDT',
      18,
      'address-0x55d398326f99059ff775485246999027b3197955-1720668660063.png',
      false,
      'bsc',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--56',
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      'USD Coin',
      'USDC',
      18,
      'address-0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d-1720669239205.png',
      false,
      'bsc',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--56',
      '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      'Wrapped BNB',
      'WBNB',
      18,
      'address-0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c.png',
      false,
      'bsc',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--56',
      '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
      'BTCB Token',
      'BTCB',
      18,
      'address-0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c.png',
      false,
      'bsc',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--56',
      '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
      'Dai Token',
      'DAI',
      18,
      'address-0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3.png',
      false,
      'bsc',
      { isPopular: true },
    ),
  ],
  'evm--42161': [
    getIndexerSwapToken(
      'evm--42161',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1720669989878.png',
      true,
      'arbitrum',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--42161',
      '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
      'Wrapped Ether',
      'WETH',
      18,
      'address-0x82af49447d8a07e3bd95bd0d56f35241523fbab1-1720668347864.png',
      false,
      'arbitrum',
      { isPopular: true, isWrapped: true },
    ),
    getIndexerSwapToken(
      'evm--42161',
      '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
      'Tether USD',
      'USDT',
      6,
      'address-0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9-1720668746569.png',
      false,
      'arbitrum',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--42161',
      '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      'USD Coin',
      'USDC',
      6,
      'address-0xaf88d065e77c8cc2239327c5edb3a432268e5831-1720669320510.png',
      false,
      'arbitrum',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--42161',
      '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
      'Wrapped BTC',
      'WBTC',
      8,
      'address-0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f.png',
      false,
      'arbitrum',
      { isPopular: true },
    ),
  ],
  'evm--8453': [
    getIndexerSwapToken(
      'evm--8453',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1721283653512.png',
      true,
      'base',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--8453',
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      'USD Coin',
      'USDC',
      6,
      'address-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913-1720669295958.png',
      false,
      'base',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--8453',
      '0x4200000000000000000000000000000000000006',
      'Wrapped Ether',
      'WETH',
      18,
      'address-0x4200000000000000000000000000000000000006-1720668314458.png',
      false,
      'base',
      { isPopular: true, isWrapped: true },
    ),
    getIndexerSwapToken(
      'evm--8453',
      '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
      'Dai Stablecoin',
      'DAI',
      18,
      'address-0x50c5725949a6f0c72e6c4a641f24049a917db0cb.png',
      false,
      'base',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--8453',
      '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
      'USD Base Coin',
      'USDbC',
      6,
      'address-0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca.png',
      false,
      'base',
      { isPopular: true },
    ),
  ],
  'evm--137': [
    getIndexerSwapToken(
      'evm--137',
      '',
      'Polygon',
      'POL',
      18,
      'address--1720669850773.png',
      true,
      'polygon',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--137',
      '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
      'USD Coin',
      'USDC',
      6,
      'address-0x3c499c542cef5e3811e1192ce70d8cc03d5c3359-1720669265327.png',
      false,
      'polygon',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--137',
      '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      'Tether',
      'USDT',
      6,
      'address-0xc2132d05d31c914a87c6611c10748aeb04b58e8f-1720668692077.png',
      false,
      'polygon',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--137',
      '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
      '(PoS) Wrapped BTC',
      'WBTC',
      8,
      'address-0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6.png',
      false,
      'polygon',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--137',
      '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      'Wrapped Ether',
      'WETH',
      18,
      'address-0x7ceb23fd6bc0add59e62ac25578270cff1b9f619-1720668277811.png',
      false,
      'polygon',
      { isPopular: true, isWrapped: true },
    ),
  ],
  'sol--101': [
    getDashboardSwapToken(
      'sol--101',
      '',
      'Solana',
      'SOL',
      9,
      'upload_1723028080499.0.6427884446150325.0.png',
      true,
      'sol',
      { isPopular: true },
    ),
    getOnChainSwapToken(
      'sol--101',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'USDC',
      'USDC',
      6,
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png',
      false,
      'sol',
      { isPopular: true },
    ),
    getOnChainSwapToken(
      'sol--101',
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      'Tether',
      'USDT',
      6,
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB.png',
      false,
      'sol',
      { isPopular: true },
    ),
    getOnChainSwapToken(
      'sol--101',
      '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
      'PayPal USD',
      'PYUSD',
      6,
      '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo.png',
      false,
      'sol',
      { isPopular: true },
    ),
  ],
  'evm--43114': [
    getIndexerSwapToken(
      'evm--43114',
      '',
      'Avalanche',
      'AVAX',
      18,
      'address-.png',
      true,
      'avalanche',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--43114',
      '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
      'USD Coin',
      'USDC',
      6,
      'address-0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e-1720669345050.png',
      false,
      'avalanche',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--43114',
      '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
      'TetherToken',
      'USDt',
      6,
      'address-0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7-1720668785282.png',
      false,
      'avalanche',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--43114',
      '0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab',
      'Wrapped Ether',
      'WETH.e',
      18,
      'address-0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab-1720668375997.png',
      false,
      'avalanche',
      { isPopular: true },
    ),
  ],
  'evm--10': [
    getIndexerSwapToken(
      'evm--10',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1721283262262.png',
      true,
      'optimism',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--10',
      '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
      'USD Coin',
      'USDC',
      6,
      'address-0x0b2c639c533813f4aa9d7837caf62653d097ff85-1720669214787.png',
      false,
      'optimism',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--10',
      '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
      'Tether USD',
      'USDT',
      6,
      'address-0x94b008aa00579c1307b0ef2c499ad98a8ce58e58-1720668629218.png',
      false,
      'optimism',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--10',
      '0x68f180fcce6836688e9084f035309e29bf0a2095',
      'Wrapped BTC',
      'WBTC',
      8,
      'address-0x68f180fcce6836688e9084f035309e29bf0a2095.png',
      false,
      'optimism',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--10',
      '0x4200000000000000000000000000000000000042',
      'Optimism',
      'OP',
      18,
      'address-0x4200000000000000000000000000000000000042.png',
      false,
      'optimism',
      { isPopular: true },
    ),
  ],
  'tron--0x2b6653dc': [
    getIndexerSwapToken(
      'tron--0x2b6653dc',
      '',
      'Tron',
      'TRX',
      6,
      'address--1720669765494.png',
      true,
      'tron',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'tron--0x2b6653dc',
      'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      'Tether USD',
      'USDT',
      6,
      'address-TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t-1720668500740.png',
      false,
      'tron',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'tron--0x2b6653dc',
      'TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4',
      'TrueUSD',
      'TUSD',
      18,
      'address-TUpMhErZL2fhh4sVNULAbNKLokS4GjC1F4.png',
      false,
      'tron',
      { isPopular: true },
    ),
  ],
  'evm--324': [
    getOnChainSwapToken(
      'evm--324',
      '',
      'Ethereum',
      'ETH',
      18,
      'native.png',
      true,
      'zksync-era-mainnet',
      { isPopular: true },
    ),
    getOnChainSwapToken(
      'evm--324',
      '0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4',
      'Bridged USDC (zkSync)',
      'USDC.e',
      6,
      '0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4.png',
      false,
      'zksync-era-mainnet',
      { isPopular: true },
    ),
    getOnChainSwapToken(
      'evm--324',
      '0x493257fd37edb34451f62edf8d2a0c418852ba4c',
      'Tether USD',
      'USDT',
      6,
      '0x493257fd37edb34451f62edf8d2a0c418852ba4c.png',
      false,
      'zksync-era-mainnet',
      { isPopular: true },
    ),
    getOnChainSwapToken(
      'evm--324',
      '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91',
      'Wrapped Ether',
      'WETH',
      18,
      '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91.png',
      false,
      'zksync-era-mainnet',
      { isPopular: true },
    ),
  ],
  'aptos--1': [
    getDashboardSwapToken(
      'aptos--1',
      '0x1::aptos_coin::AptosCoin',
      'Aptos Coin',
      'APT',
      8,
      'upload_1762841036401.0.9828413421109685.0.png',
      true,
      'apt',
      { isPopular: true },
      true,
    ),
    getOnChainSwapToken(
      'aptos--1',
      '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b',
      'Tether USD',
      'USDt',
      6,
      '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b.png',
      false,
      'apt',
      { isPopular: true },
      true,
    ),
    getOnChainSwapToken(
      'aptos--1',
      '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b',
      'USDC',
      'USDC',
      6,
      '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b.png',
      false,
      'apt',
      { isPopular: true },
      true,
    ),
  ],
};

export const swapBridgeDefaultTokenMap: Record<string, ISwapToken[]> = {
  'evm--1': [
    getIndexerSwapToken(
      'evm--1',
      '',
      'Ethereum',
      'ETH',
      18,
      'address--1721282106924.png',
      true,
      'eth',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--1',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'Tether USD',
      'USDT',
      6,
      'address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png',
      false,
      'eth',
      { isPopular: true },
    ),
    getIndexerSwapToken(
      'evm--1',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'USD Coin',
      'USDC',
      6,
      'address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      false,
      'eth',
      { isPopular: true },
    ),
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
    toTokenDefaultMatch: getIndexerSwapToken(
      'evm--56',
      '0x55d398326f99059ff775485246999027b3197955',
      'Tether USD',
      'USDT',
      18,
      'address-0x55d398326f99059ff775485246999027b3197955-1720668660063.png',
      false,
      'bsc',
      { isPopular: true },
    ),
  },
  {
    fromTokens: [
      {
        networkId: 'evm--1',
        contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        isNative: false,
      },
    ],
    toTokenDefaultMatch: getIndexerSwapToken(
      'evm--56',
      '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      'USD Coin',
      'USDC',
      18,
      'address-0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d-1720669239205.png',
      false,
      'bsc',
      { isPopular: true },
    ),
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
    toTokenDefaultMatch: getIndexerSwapToken(
      'evm--1',
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      'Tether USD',
      'USDT',
      6,
      'address-0xdac17f958d2ee523a2206206994597c13d831ec7-1722246302921.png',
      false,
      'eth',
      { isPopular: true },
    ),
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
    toTokenDefaultMatch: getIndexerSwapToken(
      'evm--1',
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      'USD Coin',
      'USDC',
      6,
      'address-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png',
      false,
      'eth',
      { isPopular: true },
    ),
  },
];

export const swapBridgeDefaultTokenExtraConfigs = {
  defaultToToken: getIndexerSwapToken(
    'evm--1',
    '',
    'Ethereum',
    'ETH',
    18,
    'address--1721282106924.png',
    true,
    'eth',
    { isPopular: true },
  ),
  mainNetDefaultToTokenConfig: {
    networkId: 'evm--1',
    defaultToToken: getIndexerSwapToken(
      'evm--56',
      '',
      'BNB',
      'BNB',
      18,
      'address-.png',
      true,
      'bsc',
      { isPopular: true },
    ),
  },
};

export function getSwapBridgeDefaultToToken(
  token: Pick<ISwapToken, 'networkId' | 'contractAddress'>,
) {
  const matchedConfig = swapBridgeDefaultTokenConfigs.find((config) =>
    config.fromTokens.some(
      (fromToken) =>
        fromToken.networkId === token.networkId &&
        fromToken.contractAddress.toLowerCase() ===
          token.contractAddress.toLowerCase(),
    ),
  );

  if (matchedConfig) {
    return matchedConfig.toTokenDefaultMatch;
  }

  return token.networkId ===
    swapBridgeDefaultTokenExtraConfigs.mainNetDefaultToTokenConfig.networkId
    ? swapBridgeDefaultTokenExtraConfigs.mainNetDefaultToTokenConfig
        .defaultToToken
    : swapBridgeDefaultTokenExtraConfigs.defaultToToken;
}

export const wrappedTokens = [
  {
    networkId: 'evm--1',
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    logo: getStaticLogoURI('WETH'),
  },
  {
    networkId: 'evm--56',
    address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    logo: getStaticLogoURI('wbnb'),
  },
  {
    networkId: 'evm--137',
    address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    logo: getStaticLogoURI('wmatic_provider'),
  },
  {
    networkId: 'evm--42161',
    address: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    logo: getStaticLogoURI('WETH'),
  },
  {
    networkId: 'evm--43114',
    address: '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7',
    logo: getStaticLogoURI('wavax'),
  },
  {
    networkId: 'evm--128',
    address: '0x5545153ccfca01fbd7dd11c0b23ba694d9509a6f',
    logo: getStaticLogoURI('wht'),
  },
  {
    networkId: 'evm--10',
    address: '0x4200000000000000000000000000000000000006',
    logo: getStaticLogoURI('WETH'),
  },
  {
    networkId: 'evm--8453',
    address: '0x4200000000000000000000000000000000000006',
    logo: getStaticLogoURI('WETH'),
  },
  {
    networkId: 'evm--324',
    address: '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91',
    logo: getStaticLogoURI('WETH'),
  },
  {
    networkId: 'evm--5000',
    address: '0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8',
    logo: getOnChainTokenLogoURI(
      'evm--5000',
      '0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8.png',
      true,
    ),
  },
];
