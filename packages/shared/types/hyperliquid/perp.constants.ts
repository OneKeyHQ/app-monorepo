import type { IHex } from './sdk';

export const FALLBACK_BUILDER_ADDRESS =
  '0x9b12E858dA780a96876E3018780CF0D83359b0bb' as IHex;

export const FALLBACK_MAX_BUILDER_FEE = 40;

export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as IHex;

export const HYPERLIQUID_DEPOSIT_ADDRESS =
  '0x2df1c51e09aecf9cacb7bc98cb1742757f163df7' as IHex;

export const MIN_DEPOSIT_AMOUNT = 5;

export const USDC_TOKEN_INFO = {
  address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as IHex,
  decimals: 6,
  name: 'USD Coin',
  symbol: 'USDC',
  isNative: false,
} as const;
