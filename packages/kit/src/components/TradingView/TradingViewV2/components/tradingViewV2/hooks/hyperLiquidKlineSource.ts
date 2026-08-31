import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketBasicConfigData } from '@onekeyhq/shared/types/marketV2';

export interface IHyperLiquidKlineSourceResult {
  isHyperLiquidSource: boolean;
  symbol: string | undefined;
  isLoading: boolean;
}

interface IPreparedHyperLiquidKlineSource {
  identityKey: string;
  result: IHyperLiquidKlineSourceResult;
}

// A token click replaces this active selection before the detail chart mounts.
let preparedKlineSource: IPreparedHyperLiquidKlineSource | undefined;

function normalizeTokenAddress(tokenAddress: string, networkId: string) {
  return (
    normalizeTokenContractAddress({
      networkId,
      contractAddress: tokenAddress.trim(),
    }) ?? ''
  );
}

function buildKlineSourceIdentityKey({
  networkId,
  tokenAddress,
}: {
  networkId: string;
  tokenAddress: string;
}) {
  return `${networkId.trim()}:${normalizeTokenAddress(
    tokenAddress,
    networkId,
  )}`;
}

export function resolveHyperLiquidKlineSource({
  basicConfig,
  isLoading,
  networkId,
  tokenAddress,
}: {
  basicConfig: IMarketBasicConfigData | undefined;
  isLoading: boolean | undefined;
  networkId: string;
  tokenAddress: string;
}): IHyperLiquidKlineSourceResult {
  if (!basicConfig) {
    return {
      isHyperLiquidSource: false,
      symbol: undefined,
      isLoading: isLoading !== false,
    };
  }

  const normalizedTokenAddress = normalizeTokenAddress(tokenAddress, networkId);
  const match = basicConfig.HyperLiquidKlineSourceTokens?.find(
    (token) =>
      token.networkId === networkId &&
      normalizeTokenAddress(token.tokenAddress, token.networkId) ===
        normalizedTokenAddress,
  );

  return {
    isHyperLiquidSource: Boolean(match),
    symbol: match?.symbol,
    isLoading: false,
  };
}

export function prepareHyperLiquidKlineSource({
  basicConfig,
  networkId,
  tokenAddress,
}: {
  basicConfig: IMarketBasicConfigData;
  networkId: string;
  tokenAddress: string;
}) {
  const result = resolveHyperLiquidKlineSource({
    basicConfig,
    isLoading: false,
    networkId,
    tokenAddress,
  });
  preparedKlineSource = {
    identityKey: buildKlineSourceIdentityKey({ networkId, tokenAddress }),
    result,
  };
  return result;
}

export function getPreparedHyperLiquidKlineSource({
  networkId,
  tokenAddress,
}: {
  networkId: string;
  tokenAddress: string;
}) {
  const identityKey = buildKlineSourceIdentityKey({
    networkId,
    tokenAddress,
  });
  return preparedKlineSource?.identityKey === identityKey
    ? preparedKlineSource.result
    : undefined;
}

export function resolveMarketTradingViewStorageNamespace({
  isHyperLiquidSource,
  storageNamespace,
}: {
  isHyperLiquidSource: boolean;
  storageNamespace?: string;
}) {
  const requestedNamespace = storageNamespace?.trim();
  if (
    isHyperLiquidSource &&
    (!requestedNamespace || requestedNamespace === 'market')
  ) {
    return 'market-hyperliquid';
  }
  return requestedNamespace || 'market';
}
