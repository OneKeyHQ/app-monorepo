import { z } from 'zod';

import { chainId, tokenId } from './common';

// ---- token search ----
export const tokenSearchInputSchema = z.object({
  query: z.string().describe('Search keyword (symbol, name, or address)'),
  chain: chainId.optional(),
  limit: z.coerce.number().optional().describe('Max results (default 10)'),
});

export const tokenSearchOutputSchema = z.array(
  z.object({
    contractAddress: z.string(),
    symbol: z.string(),
    name: z.string().nullable(),
    decimals: z.number(),
    price: z.string().nullable(),
    networkId: z.string(),
    logoUrl: z.string().nullable(),
    isNative: z.boolean(),
    liquidity: z.string().nullable(),
    marketCap: z.string().nullable(),
    communityRecognized: z.boolean(),
  }),
);

// ---- token info ----
export const tokenInfoInputSchema = z.object({
  chain: chainId,
  token: tokenId,
});

export const tokenInfoOutputSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  contractAddress: z.string(),
  networkId: z.string(),
  isNative: z.boolean(),
  logoUrl: z.string().nullable(),
  price: z.string().nullable(),
  marketCap: z.string().nullable(),
  fdv: z.string().nullable(),
  tvl: z.string().nullable(),
  liquidity: z.string().nullable(),
  circulatingSupply: z.string().nullable(),
  holders: z.number().nullable(),
  priceChange1hPercent: z.string().nullable(),
  priceChange4hPercent: z.string().nullable(),
  priceChange24hPercent: z.string().nullable(),
  extraData: z
    .object({ website: z.string().optional(), twitter: z.string().optional() })
    .nullable(),
  supportSwap: z.object({ enable: z.boolean() }).nullable(),
  communityRecognized: z.boolean(),
});

// ---- token price ----
export const tokenPriceInputSchema = z.object({
  chain: chainId,
  token: tokenId,
});

export const tokenPriceOutputSchema = z.object({
  symbol: z.string(),
  contractAddress: z.string(),
  networkId: z.string(),
  price: z.string().nullable(),
  priceChange1mPercent: z.string().nullable(),
  priceChange5mPercent: z.string().nullable(),
  priceChange1hPercent: z.string().nullable(),
  priceChange4hPercent: z.string().nullable(),
  priceChange24hPercent: z.string().nullable(),
});

// ---- token trending ----
export const tokenTrendingInputSchema = z.object({
  chain: chainId.optional(),
  limit: z.coerce.number().optional(),
});

export const tokenTrendingOutputSchema = z.array(
  z.object({
    symbol: z.string(),
    name: z.string().nullable(),
    contractAddress: z.string(),
    networkId: z.string(),
    price: z.string().nullable(),
    priceChange24hPercent: z.string().nullable(),
    marketCap: z.string().nullable(),
    logoUrl: z.string().nullable(),
    isNative: z.boolean(),
    communityRecognized: z.boolean(),
  }),
);

// ---- token trades ----
export const tokenTradesInputSchema = z.object({
  chain: chainId,
  token: tokenId,
});

const tradeStats = z.object({
  trades: z.string().nullable(),
  buys: z.string().nullable(),
  sells: z.string().nullable(),
  volume: z.string().nullable(),
  vBuy: z.string().nullable(),
  vSell: z.string().nullable(),
  uniqueWallets: z.string().nullable(),
});

export const tokenTradesOutputSchema = z.object({
  symbol: z.string(),
  contractAddress: z.string(),
  networkId: z.string(),
  stats: z.object({
    '1m': tradeStats,
    '5m': tradeStats,
    '1h': tradeStats,
    '4h': tradeStats,
    '24h': tradeStats,
  }),
});

// ---- token liquidity ----
export const tokenLiquidityInputSchema = z.object({
  chain: chainId,
  token: tokenId,
});

export const tokenLiquidityOutputSchema = z.array(
  z.object({
    accountAddress: z.string(),
    amount: z.string(),
    fiatValue: z.string(),
    percentage: z.string().nullable(),
  }),
);
