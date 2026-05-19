import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_SOL,
  IMPL_TBTC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { AppError } from '../errors';
import { ERROR_CODES } from '../errors/error-codes';

export type CliChainCapability =
  | 'accountRead'
  | 'historyRead'
  | 'btcTransfer'
  | 'evmTransfer'
  | 'evmTokenMarket'
  | 'evmSecurity'
  | 'solTransfer'
  | 'signMessage'
  | 'swap';

export interface IChainConfig {
  networkId: string;
  impl: string;
  chainId: string;
  nativeDecimals: number;
  feeDecimals: number;
  feeSymbol: string;
  nativeSymbol: string;
  capabilities: ReadonlySet<CliChainCapability>;
}

const CHAIN_ALIASES: Record<string, string> = {
  ethereum: 'eth',
  avax: 'avalanche',
};

const CLI_SUPPORTED_IMPLS = new Set([IMPL_EVM, IMPL_BTC, IMPL_TBTC, IMPL_SOL]);

const EVM_CAPABILITIES = new Set<CliChainCapability>([
  'accountRead',
  'historyRead',
  'evmTransfer',
  'evmTokenMarket',
  'evmSecurity',
  'signMessage',
  'swap',
]);

const BTC_CAPABILITIES = new Set<CliChainCapability>([
  'accountRead',
  'historyRead',
  'btcTransfer',
  'swap',
]);

const TBTC_CAPABILITIES = new Set<CliChainCapability>([
  'accountRead',
  'historyRead',
  'btcTransfer',
]);

const SOL_CAPABILITIES = new Set<CliChainCapability>([
  'accountRead',
  'historyRead',
  'solTransfer',
  'signMessage',
  'swap',
]);

let chainCache: Map<string, IChainConfig> | null = null;

function getCapabilitiesForImpl(impl: string): ReadonlySet<CliChainCapability> {
  if (impl === IMPL_EVM) return EVM_CAPABILITIES;
  if (impl === IMPL_BTC) return BTC_CAPABILITIES;
  if (impl === IMPL_TBTC) return TBTC_CAPABILITIES;
  if (impl === IMPL_SOL) return SOL_CAPABILITIES;
  return new Set<CliChainCapability>();
}

function getChainMap(): Map<string, IChainConfig> {
  if (chainCache) return chainCache;

  const networks = getPresetNetworks();
  const map = new Map<string, IChainConfig>();

  for (const net of networks) {
    if (CLI_SUPPORTED_IMPLS.has(net.impl)) {
      map.set(net.shortcode.toLowerCase(), {
        networkId: net.id,
        impl: net.impl,
        chainId: net.chainId,
        nativeDecimals: net.decimals,
        feeDecimals: net.feeMeta.decimals,
        feeSymbol: net.feeMeta.symbol,
        nativeSymbol: net.symbol,
        capabilities: getCapabilitiesForImpl(net.impl),
      });
    }
  }

  chainCache = map;
  return map;
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
  const map = getChainMap();
  const config = map.get(resolved);

  if (config) return config;

  const suggestion = findClosestMatch(resolved, [...map.keys()]);
  const hint = suggestion ? `\nDid you mean: ${suggestion}?` : '';
  throw new AppError(
    ERROR_CODES.PARAM_INVALID_CHAIN.code,
    `Unsupported chain: "${shortcode}"${hint}`,
    "Run 'onekey swap networks' to see supported swap chains.",
  );
}

export function assertChainCapability(
  chainConfig: IChainConfig,
  capability: CliChainCapability,
  commandName: string,
): void {
  if (chainConfig.capabilities.has(capability)) return;

  throw new AppError(
    ERROR_CODES.PARAM_INVALID_CHAIN.code,
    `Command "${commandName}" does not support chain "${chainConfig.impl}".`,
    `Choose a supported chain for ${commandName}.`,
  );
}

export function isEvmChain(chainConfig: IChainConfig): boolean {
  return chainConfig.impl === IMPL_EVM;
}

export function isSolChain(chainConfig: IChainConfig): boolean {
  return chainConfig.impl === IMPL_SOL;
}

export function listEvmChains(): IChainConfig[] {
  return [...getChainMap().values()].filter((c) => c.impl === IMPL_EVM);
}

export function listSolChains(): IChainConfig[] {
  return [...getChainMap().values()].filter((c) => c.impl === IMPL_SOL);
}
