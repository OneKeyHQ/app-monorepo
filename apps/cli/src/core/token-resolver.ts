import BigNumber from 'bignumber.js';

import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';

import { resolveChain } from './chain-resolver';

import type { IResolvedToken } from '../types';

/** Valid EVM address: 0x followed by exactly 40 hex characters */
const EVM_ADDRESS_RE = /^0x[a-f0-9]{40}$/i;
/** Valid-looking Solana mint/account address: base58, typically 32 bytes. */
const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** V2 Market Search API raw response item — aligned with IMarketSearchV2Token */
interface IMarketSearchItem {
  name: string;
  price: string;
  symbol: string;
  address: string;
  network: string;
  logoUrl: string;
  isNative: boolean;
  decimals: number;
  liquidity: string;
  volume24h?: string;
  volume_24h?: string;
  marketCap?: string;
  priceChange24hPercent?: string;
  communityRecognized?: boolean;
}

function isValidSearchItem(item: unknown): item is IMarketSearchItem {
  if (typeof item !== 'object' || item === null) return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r.symbol === 'string' &&
    typeof r.address === 'string' &&
    typeof r.network === 'string' &&
    typeof r.decimals === 'number'
  );
}

function buildDegradedResult(
  contractAddress: string,
  networkId: string,
): IResolvedToken {
  return {
    contractAddress,
    symbol: contractAddress.slice(0, 10),
    name: null,
    decimals: null,
    isNative: false,
    networkId,
    logoUrl: null,
    price: null,
    liquidity: null,
    volume24h: null,
    marketCap: null,
    priceChange24hPercent: null,
    communityRecognized: false,
  };
}

function mapSearchItemToResolved(
  item: IMarketSearchItem,
  networkId: string,
): IResolvedToken {
  return {
    contractAddress: item.address,
    symbol: item.symbol,
    name: item.name || null,
    decimals: item.decimals,
    isNative: item.isNative,
    networkId,
    logoUrl: item.logoUrl || null,
    price: item.price && item.price !== '--' ? item.price : null,
    liquidity: item.liquidity || null,
    volume24h: item.volume24h ?? item.volume_24h ?? null,
    marketCap: item.marketCap ?? null,
    priceChange24hPercent: item.priceChange24hPercent ?? null,
    communityRecognized: item.communityRecognized ?? false,
  };
}

function isContractAddressInput(input: string, networkId: string): boolean {
  if (EVM_ADDRESS_RE.test(input)) return true;
  if (networkId === 'sol--101') return SOL_ADDRESS_RE.test(input);
  return false;
}

function contractAddressMatches(
  itemAddress: string,
  input: string,
  networkId: string,
): boolean {
  if (networkId === 'sol--101') {
    return itemAddress === input;
  }
  return itemAddress.toLowerCase() === input.toLowerCase();
}

/**
 * Pick the best match from candidates: prefer communityRecognized, then highest liquidity.
 */
function pickBestMatch(candidates: IMarketSearchItem[]): IMarketSearchItem {
  if (candidates.length === 1) return candidates[0];
  const sorted = candidates.toSorted((a, b) => {
    // communityRecognized first
    const aRec = a.communityRecognized ? 1 : 0;
    const bRec = b.communityRecognized ? 1 : 0;
    if (bRec !== aRec) return bRec - aRec;
    // then by liquidity descending
    const aLiq = new BigNumber(a.liquidity || 0);
    const bLiq = new BigNumber(b.liquidity || 0);
    return bLiq.comparedTo(aLiq);
  });
  return sorted[0];
}

/**
 * Search V2 market API and resolve to IResolvedToken.
 * Contract address input gets graceful degradation on API failure.
 * Symbol input throws BIZ_TOKEN_NOT_FOUND on no match.
 */
async function searchAndResolve(
  input: string,
  networkId: string,
): Promise<IResolvedToken> {
  const isContractAddress = isContractAddressInput(input, networkId);

  let rawResults: unknown;
  try {
    rawResults = await apiClient.get<unknown>(
      'utility',
      '/utility/v2/market/search',
      { query: input },
    );
  } catch (error) {
    if (isContractAddress) {
      return buildDegradedResult(input, networkId);
    }
    throw error;
  }

  // Runtime validation: data must be an array with valid items
  if (!Array.isArray(rawResults)) {
    if (isContractAddress) {
      return buildDegradedResult(input, networkId);
    }
    throw new AppError(
      ERROR_CODES.NET_HTTP_ERROR.code,
      'Malformed V2 market search response: expected array',
      'This may indicate an API contract change — check connectivity',
    );
  }

  const results = rawResults.filter(isValidSearchItem);

  // Filter by target networkId
  const onChain = results.filter((t) => t.network === networkId);

  if (isContractAddress) {
    const addressMatches = onChain.filter((t) =>
      contractAddressMatches(t.address, input, networkId),
    );
    if (addressMatches.length === 0) {
      return buildDegradedResult(input, networkId);
    }
    return mapSearchItemToResolved(pickBestMatch(addressMatches), networkId);
  }

  // Symbol search: exact symbol match (case insensitive)
  const symbolMatches = onChain.filter(
    (t) => t.symbol.toUpperCase() === input.toUpperCase(),
  );

  if (symbolMatches.length === 0) {
    throw new AppError(
      ERROR_CODES.BIZ_TOKEN_NOT_FOUND.code,
      `Token "${input}" not found on network ${networkId}`,
      'Check the token symbol or use the contract address instead',
    );
  }

  return mapSearchItemToResolved(pickBestMatch(symbolMatches), networkId);
}

/**
 * Resolve a token input (native symbol, contract address, or symbol text)
 * into a unified IResolvedToken.
 *
 * API: GET /utility/v2/market/search?query=<input>
 * Aligned with ServiceMarket.searchV2Token + ServiceUniversalSearch.universalSearchOfV2MarketToken
 */
export async function resolveToken(
  input: string,
  chain: string,
): Promise<IResolvedToken> {
  const chainConfig = resolveChain(chain);

  const { networkId, nativeSymbol, nativeDecimals } = chainConfig;

  // Path 1: Native token — match nativeSymbol (case insensitive)
  if (input.toUpperCase() === nativeSymbol.toUpperCase()) {
    return {
      contractAddress: '',
      symbol: nativeSymbol,
      name: nativeSymbol,
      decimals: nativeDecimals,
      isNative: true,
      networkId,
      logoUrl: null,
      price: null,
      liquidity: null,
      volume24h: null,
      marketCap: null,
      priceChange24hPercent: null,
      communityRecognized: false,
    };
  }

  // Path 2: Valid EVM contract address → search API with graceful degradation
  // Path 3: Symbol text → search API, no fallback
  // Invalid 0x prefix (not a valid EVM address) is treated as symbol search
  return searchAndResolve(input, networkId);
}
