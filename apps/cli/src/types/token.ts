/** Unified resolved token — aligned with IMarketSearchV2Token from packages/shared/types/market.ts */
export interface IResolvedToken {
  /** Contract address — empty string for native tokens */
  contractAddress: string;
  /** Symbol (e.g., "USDT", "ETH") */
  symbol: string;
  /** Full name (e.g., "Tether USD") — null if metadata API failed */
  name: string | null;
  /** Token decimals — null only if metadata API failed for contract address input */
  decimals: number | null;
  /** Whether this is the chain's native token */
  isNative: boolean;
  /** OneKey networkId (e.g., "evm--1") */
  networkId: string;
  /** Token logo URL — null if unavailable */
  logoUrl: string | null;
  /** Current USD price — null if unavailable */
  price: string | null;
  /** Liquidity in USD */
  liquidity: string | null;
  /** 24h trading volume */
  volume24h: string | null;
  /** Market cap */
  marketCap: string | null;
  /** 24h price change percent */
  priceChange24hPercent: string | null;
  /** Whether community recognized */
  communityRecognized: boolean;
}
