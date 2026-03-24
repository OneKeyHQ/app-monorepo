import { CHAINS } from '../config';
import { AppError, ERROR_CODES } from '../errors';
import { apiClient } from '../infra';

import type { IResolvedToken } from '../types';

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

/**
 * Search V2 market API and resolve to IResolvedToken.
 * Contract address input gets graceful degradation on API failure.
 * Symbol input throws BIZ_TOKEN_NOT_FOUND on no match.
 */
async function searchAndResolve(
  input: string,
  networkId: string,
): Promise<IResolvedToken> {
  const isContractAddress = input.startsWith('0x');

  let results: IMarketSearchItem[];
  try {
    results = await apiClient.get<IMarketSearchItem[]>(
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

  // Filter by target networkId
  const onChain = results.filter((t) => t.network === networkId);

  // For contract address: match by address (case insensitive)
  // For symbol: exact symbol match (case insensitive)
  const match = isContractAddress
    ? onChain.find((t) => t.address.toLowerCase() === input.toLowerCase())
    : onChain.find((t) => t.symbol.toUpperCase() === input.toUpperCase());

  if (!match) {
    if (isContractAddress) {
      return buildDegradedResult(input, networkId);
    }
    throw new AppError(
      ERROR_CODES.BIZ_TOKEN_NOT_FOUND.code,
      `Token "${input}" not found on network ${networkId}`,
      'Check the token symbol or use the contract address instead',
    );
  }

  return mapSearchItemToResolved(match, networkId);
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
  const chainConfig = CHAINS[chain];
  if (!chainConfig) {
    throw new AppError(
      ERROR_CODES.PARAM_INVALID_CHAIN.code,
      `Unsupported chain: "${chain}"`,
      `Valid chains: ${Object.keys(CHAINS).join(', ')}`,
    );
  }

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

  // Path 2 + 3: Both contract address and symbol use the same V2 search API
  return searchAndResolve(input, networkId);
}
