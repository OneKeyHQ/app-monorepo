import type { IHex } from './sdk';

export const MAX_DECIMALS_PERP = 6;
export const MAX_SIGNIFICANT_FIGURES = 5;
export const MAX_PRICE_INTEGER_DIGITS = 12;

export const FALLBACK_BUILDER_ADDRESS =
  '0x9b12E858dA780a96876E3018780CF0D83359b0bb' as IHex;

export const FALLBACK_MAX_BUILDER_FEE = 40;

export const HYPERLIQUID_DEPOSIT_ADDRESS =
  '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7' as IHex;

export const MIN_DEPOSIT_AMOUNT = 5;
export const WITHDRAW_FEE = 1;

export const USDC_TOKEN_INFO = {
  address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as IHex,
  decimals: 6,
  name: 'USD Coin',
  symbol: 'USDC',
  isNative: false,
} as const;

export const HYPERLIQUID_NETWORK_INACTIVE_TIMEOUT_MS = 60_000;
export const HYPERLIQUID_REFRESH_DATA_FLOW_THRESHOLD_MS = 10_000;
export const MIN_WITHDRAW_AMOUNT = 2; // Minimum withdraw amount is 2 USDC

export const TERMS_OF_SERVICE_URL =
  'https://help.onekey.so/articles/11461297-user-service-agreement';
export const PRIVACY_POLICY_URL =
  'https://help.onekey.so/articles/11461298-privacy-policy';

// Multi-DEX support constants
export const DEX_PREFIXES = ['xyz'] as const;
export const DEX_SEPARATOR = ':';
export const XYZ_DEX_PREFIX = `${DEX_PREFIXES[0]}${DEX_SEPARATOR}`;
export const XYZ_ASSET_ID_OFFSET = 110_000;
export const XYZ_ASSET_ID_LENGTH = `${XYZ_ASSET_ID_OFFSET}`.length;

// Token Selector default values
export const DEFAULT_PERP_TOKEN_SORT_FIELD = 'volume24h';
export const DEFAULT_PERP_TOKEN_SORT_DIRECTION = 'desc';
export const DEFAULT_PERP_TOKEN_ACTIVE_TAB = 'all';

// Perp Layout Configuration
export const PERP_LAYOUT_CONFIG = {
  main: {
    marketMinWidth: 400,
    tradingMinWidth: 280,
    tradingMaxWidth: 800,
  },
  // Fixed desktop layout (Binance Futures-like): when window height is smaller
  // than total content height, page scrolls vertically; individual modules can
  // still scroll internally.
  desktop: {
    tickerBarHeight: 54,
    panelHeaderHeight: 38,
    bottomPanelHeaderHeight: 46,
    // Use a height that aligns cleanly with order book row steps to avoid a
    // visible blank gap at the bottom edge.
    marketContentHeight: 588,
    bottomPanelHeight: 480,
    widths: {
      orderBook: 280,
      trading: 320,
    },
  },
} as const;
