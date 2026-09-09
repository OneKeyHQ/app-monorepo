import type { IHex } from './sdk';

interface IUsdcWithdrawDestinationConfigBase {
  name: string;
  networkId: string;
  signatureChainId: IHex;
}

export interface ICctpWithdrawDestinationConfig extends IUsdcWithdrawDestinationConfigBase {
  id: 'ethereum' | 'avalanche' | 'optimism' | 'arbitrum' | 'base';
  transferType: 'cctp';
  domain: 0 | 1 | 2 | 3 | 6;
  addressEncoding: 'hex';
  fallbackFee: number;
  supportsLegacyBridge: boolean;
}

export interface IHyperEvmWithdrawDestinationConfig extends IUsdcWithdrawDestinationConfigBase {
  id: 'hyperevm';
  transferType: 'hyperEvm';
}

export type IUsdcWithdrawDestinationConfig =
  | ICctpWithdrawDestinationConfig
  | IHyperEvmWithdrawDestinationConfig;

export type IUsdcWithdrawFeeComponent =
  | {
      kind: 'cctpForwarding' | 'legacyBridge';
      amount: string;
      token: 'USDC';
      debitedFrom: 'withdrawAmount';
      isEstimate: boolean;
    }
  | {
      kind: 'hyperEvmGas';
      amount: string;
      token: 'USDC';
      debitedFrom: 'spotHypeOrSourceUsdc';
      isEstimate: true;
      displayAsLessThan: true;
    };

export interface IUsdcWithdrawFeeQuote {
  components: IUsdcWithdrawFeeComponent[];
  quotedAt: number;
}

export const MAX_DECIMALS_PERP = 6;
export const MAX_DECIMALS_SPOT = 8;
export const MAX_SIGNIFICANT_FIGURES = 5;
export const MAX_PRICE_INTEGER_DIGITS = 12;

export const FALLBACK_BUILDER_ADDRESS =
  '0x9b12E858dA780a96876E3018780CF0D83359b0bb' as IHex;

export const FALLBACK_MAX_BUILDER_FEE = 50;

export const HYPERLIQUID_DEPOSIT_ADDRESS =
  '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7' as IHex;

export const MIN_DEPOSIT_AMOUNT = 5;
// Legacy Arbitrum bridge (`withdraw3`) fee. Kept for the `bridge` route.
export const WITHDRAW_FEE = 1;

// Receives every Core -> HyperEVM send, so a `send` here is USDC leaving
// HyperCore whether by CCTP withdrawal or a plain transfer.
export const HYPEREVM_SYSTEM_ADDRESS =
  '0x2000000000000000000000000000000000000000' as IHex;
export const USDC_WITHDRAW_GAS_RESERVE = 0.01;

// Keep the allowlist here so the UI and BG signer cannot disagree on a route or
// EIP-712 signing chain. External chains use Circle CCTP domain ids; HyperEVM is
// a native HyperCore sendAsset transfer and does not have a CCTP destination.
export const USDC_WITHDRAW_DESTINATIONS = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    networkId: 'evm--1',
    transferType: 'cctp',
    domain: 0,
    addressEncoding: 'hex',
    signatureChainId: '0x1',
    fallbackFee: 1.2,
    supportsLegacyBridge: false,
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    networkId: 'evm--43114',
    transferType: 'cctp',
    domain: 1,
    addressEncoding: 'hex',
    signatureChainId: '0xa86a',
    fallbackFee: 0.2,
    supportsLegacyBridge: false,
  },
  {
    id: 'optimism',
    name: 'OP Mainnet',
    networkId: 'evm--10',
    transferType: 'cctp',
    domain: 2,
    addressEncoding: 'hex',
    signatureChainId: '0xa',
    fallbackFee: 0.2,
    supportsLegacyBridge: false,
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    networkId: 'evm--42161',
    transferType: 'cctp',
    domain: 3,
    addressEncoding: 'hex',
    signatureChainId: '0xa4b1',
    fallbackFee: 0.2,
    supportsLegacyBridge: true,
  },
  {
    id: 'base',
    name: 'Base',
    networkId: 'evm--8453',
    transferType: 'cctp',
    domain: 6,
    addressEncoding: 'hex',
    signatureChainId: '0x2105',
    fallbackFee: 0.2,
    supportsLegacyBridge: false,
  },
  {
    id: 'hyperevm',
    name: 'HyperEVM',
    networkId: 'evm--999',
    transferType: 'hyperEvm',
    // HyperEVM sendAsset accepts any valid EVM chain id for replay protection.
    signatureChainId: '0xa4b1',
  },
] as const satisfies readonly IUsdcWithdrawDestinationConfig[];

export type IUsdcWithdrawDestinationId =
  (typeof USDC_WITHDRAW_DESTINATIONS)[number]['id'];

export function getUsdcWithdrawDestination(
  id: string,
): IUsdcWithdrawDestinationConfig | undefined {
  return USDC_WITHDRAW_DESTINATIONS.find((item) => item.id === id);
}

export const DEFAULT_USDC_WITHDRAW_DESTINATION_ID: IUsdcWithdrawDestinationId =
  'arbitrum';
export const CCTP_WITHDRAW_GAS_LIMIT = 200_000;
// Empty hook data makes CoreDepositWallet attach the default forwarding hook, so
// Circle delivers to the recipient instead of leaving them to claim it.
export const CCTP_WITHDRAW_HOOK_DATA = '0x';

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
export const PERPS_IP_RESTRICTION_HELP_URL =
  'https://help.onekey.so/articles/15533117';

// Multi-DEX support constants
// HIP-3 assetId = BASE + hlDexIndex * STRIDE + universeIndex
const HIP3_ASSET_ID_BASE = 100_000;
export const HIP3_ASSET_ID_STRIDE = 10_000;

// `hlDexIndex` is the slot in the `perpDexs` response.
// APPEND ONLY: array position is the local dexIndex, baked into the positional
// `tradingUniverses` cache, which has no migration path.
export const SUB_DEX_LIST = [
  { prefix: 'xyz', hlDexIndex: 1 },
  { prefix: 'para', hlDexIndex: 8 },
  { prefix: 'io', hlDexIndex: 10 },
] as const;

// Sent with every server request whose payload can carry a sub-DEX coin, so the
// backend can withhold a dex from builds that predate it. A client that omits it
// is served the pre-`io` dataset, which is how the market list and the perps
// config silently lost their `io` rows. Bump on every SUB_DEX_LIST addition.
export const PERPS_ASSET_TYPE_VERSION = 3;

export const DEX_SEPARATOR = ':';

export const DEX_PREFIXES = SUB_DEX_LIST.map((item) => item.prefix);

export type IPerpDexPrefix = (typeof DEX_PREFIXES)[number];

// Prefixes that a real main-DEX symbol starts with, so a separator-free link
// (`IOTA`) reads both as that symbol and as `<prefix>:<rest>`. With no universe
// to settle it the literal symbol is the likelier market; for every other
// prefix the literal form is no market at all, so the split guess wins.
// Re-check a new prefix against the main-DEX universe before registering it:
// `cash` (hyperliquid dex 7) shadows a listed cat-themed market and belongs
// here if adopted.
export const MAIN_DEX_SHADOWED_DEX_PREFIXES: readonly IPerpDexPrefix[] = ['io'];

export const DEX_ASSET_ID_OFFSETS: readonly number[] = [
  0,
  ...SUB_DEX_LIST.map(
    (item) => HIP3_ASSET_ID_BASE + item.hlDexIndex * HIP3_ASSET_ID_STRIDE,
  ),
];

export const XYZ_DEX_PREFIX = `${SUB_DEX_LIST[0].prefix}${DEX_SEPARATOR}`;
export const XYZ_ASSET_ID_OFFSET = DEX_ASSET_ID_OFFSETS[1];

// Hyperliquid spot assetId = SPOT_ASSET_ID_OFFSET + spotUniverse.index
export const SPOT_ASSET_ID_OFFSET = 10_000;

// Quantize Date.now() to this window so near-simultaneous callers
// produce identical memoizee cache keys (e.g. loadTradesHistory).
export const CACHE_TIME_QUANTIZE_MS = 10_000;

// Token Selector default values
export const DEFAULT_PERP_TOKEN_SORT_FIELD = 'volume24h';
export const DEFAULT_PERP_TOKEN_SORT_DIRECTION = 'desc';
export const DEFAULT_PERP_TOKEN_ACTIVE_TAB = 'perps';

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
    tickerBarHeight: 60,
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
