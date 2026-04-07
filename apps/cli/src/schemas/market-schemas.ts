import { z } from 'zod';

import { chainId, tokenId } from './common';

// ---- market price (single) ----
export const marketPriceInputSchema = z.object({
  chain: chainId,
  token: tokenId,
});

export const marketPriceOutputSchema = z.object({
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

// ---- market prices (batch) ----
export const marketPricesInputSchema = z.object({
  tokens: z
    .string()
    .describe(
      'Comma-separated chain:address pairs (e.g. "eth:0x...,bsc:0x...")',
    ),
});

export const marketPricesOutputSchema = z.array(
  z.object({
    symbol: z.string(),
    contractAddress: z.string(),
    networkId: z.string(),
    price: z.string().nullable(),
    priceChange24hPercent: z.string().nullable(),
  }),
);

// ---- market kline ----
export const marketKlineInputSchema = z.object({
  chain: chainId,
  token: tokenId,
  interval: z
    .string()
    .describe(
      'Kline interval. Lowercase = minutes (1m, 5m, 15m, 30m). Uppercase = hours/days (1H, 4H, 1D, 1W).',
    ),
  limit: z.coerce
    .number()
    .optional()
    .describe('Number of candles (default 100)'),
});

export const marketKlineOutputSchema = z.array(
  z.object({
    o: z.number().describe('Open price'),
    h: z.number().describe('High price'),
    l: z.number().describe('Low price'),
    c: z.number().describe('Close price'),
    v: z.number().describe('Volume'),
    t: z.number().describe('Timestamp (seconds)'),
  }),
);
