export enum EExchangeId {
  Binance = 'binance',
  OKX = 'okx',
  Coinbase = 'coinbase',
}

export interface IExchangeConfig {
  id: EExchangeId;
  name: string;
  iconName: 'BinanceBrand' | 'OkxBrand' | 'CoinbaseBrand';
  /** URL scheme for canOpenURL detection (e.g., 'bnc://') */
  deepLinkScheme: string;
  /** Alternative URL for canOpenURL detection when app uses a different scheme than deepLinkScheme */
  detectionUrl?: string;
  /** URL to open the exchange app */
  appOpenUrl: string;
  iconBgColor: string;
  iconColor: string;
  /** Help article ID for fallback (when app not installed) */
  helpArticleId: string;
}

export const EXCHANGE_CONFIGS: Record<EExchangeId, IExchangeConfig> = {
  [EExchangeId.Binance]: {
    id: EExchangeId.Binance,
    name: 'Binance',
    iconName: 'BinanceBrand',
    deepLinkScheme: 'bnc://',
    appOpenUrl: 'bnc://app.binance.com/mp/app',
    iconBgColor: '$yellow6',
    iconColor: '$yellow11',
    helpArticleId: '12553421',
  },
  [EExchangeId.OKX]: {
    id: EExchangeId.OKX,
    name: 'OKX',
    iconName: 'OkxBrand',
    deepLinkScheme: 'okx://',
    appOpenUrl: 'okx://main',
    iconBgColor: '$neutral6',
    iconColor: '$neutral11',
    helpArticleId: '12553973',
  },
  [EExchangeId.Coinbase]: {
    id: EExchangeId.Coinbase,
    name: 'Coinbase',
    iconName: 'CoinbaseBrand',
    deepLinkScheme: 'coinbase://',
    detectionUrl: 'cbwallet://',
    appOpenUrl: 'https://www.coinbase.com/',
    iconBgColor: '$blue6',
    iconColor: '$blue11',
    helpArticleId: '12561338',
  },
};

/** All exchange IDs in display order */
export const ALL_EXCHANGE_IDS = [
  EExchangeId.Binance,
  EExchangeId.OKX,
  EExchangeId.Coinbase,
] as const;
