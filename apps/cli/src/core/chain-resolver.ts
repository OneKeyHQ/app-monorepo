import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';

import { AppError } from '../errors';
import { ERROR_CODES } from '../errors/error-codes';

export interface IChainConfig {
  networkId: string;
  impl: string;
  chainId: string;
  nativeDecimals: number;
  feeDecimals: number;
  feeSymbol: string;
  nativeSymbol: string;
}

const CHAIN_ALIASES: Record<string, string> = {
  ethereum: 'eth',
};

let evmChainCache: Map<string, IChainConfig> | null = null;

/** Maps lowercase native symbol to shortcode for fuzzy suggestion fallback */
let symbolToShortcode: Map<string, string> | null = null;

function getEvmChainMap(): Map<string, IChainConfig> {
  if (evmChainCache) return evmChainCache;

  const networks = getPresetNetworks();
  const map = new Map<string, IChainConfig>();
  const symMap = new Map<string, string>();

  for (const net of networks) {
    if (net.impl === 'evm') {
      const key = net.shortcode.toLowerCase();
      map.set(key, {
        networkId: net.id,
        impl: net.impl,
        chainId: net.chainId,
        nativeDecimals: net.decimals,
        feeDecimals: net.feeMeta.decimals,
        feeSymbol: net.feeMeta.symbol,
        nativeSymbol: net.symbol,
      });
      symMap.set(net.symbol.toLowerCase(), key);
    }
  }

  evmChainCache = map;
  symbolToShortcode = symMap;
  return map;
}

function getSymbolToShortcode(): Map<string, string> {
  if (!symbolToShortcode) getEvmChainMap();
  return symbolToShortcode!;
}

/**
 * Simple Levenshtein distance for fuzzy matching.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from(
    { length: m + 1 },
    () => Array(n + 1).fill(0) as number[],
  );

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

function findClosestMatch(input: string, candidates: string[]): string | null {
  const lower = input.toLowerCase();

  // prefix match
  const prefixMatch = candidates.find((c) => c.startsWith(lower));
  if (prefixMatch) return prefixMatch;

  // includes match
  const includesMatch = candidates.find((c) => c.includes(lower));
  if (includesMatch) return includesMatch;

  // reverse includes
  const reverseMatch = candidates.find((c) => lower.includes(c));
  if (reverseMatch) return reverseMatch;

  // Levenshtein distance — accept if distance <= 40% of longer string
  let bestDist = Infinity;
  let bestCandidate: string | null = null;
  for (const c of candidates) {
    const dist = levenshtein(lower, c);
    const maxLen = Math.max(lower.length, c.length);
    if (dist < bestDist && dist / maxLen <= 0.4) {
      bestDist = dist;
      bestCandidate = c;
    }
  }

  return bestCandidate;
}

export function resolveChain(shortcode: string): IChainConfig {
  const normalized = shortcode.toLowerCase();
  const resolved = CHAIN_ALIASES[normalized] ?? normalized;
  const map = getEvmChainMap();
  const config = map.get(resolved);

  if (config) return config;

  // Check if the input matches a known native symbol (e.g. "avax" → "avalanche")
  const symMap = getSymbolToShortcode();
  const symbolMatch = symMap.get(resolved);
  const suggestion = symbolMatch ?? findClosestMatch(resolved, [...map.keys()]);
  const hint = suggestion ? `\nDid you mean: ${suggestion}?` : '';
  throw new AppError(
    ERROR_CODES.PARAM_INVALID_CHAIN.code,
    `Unsupported chain: "${shortcode}"${hint}`,
    "Run 'onekey swap networks' to see supported swap chains.",
  );
}

export function listEvmChains(): IChainConfig[] {
  return [...getEvmChainMap().values()];
}
