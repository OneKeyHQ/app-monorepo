import {
  getDefaultStockTokenVariant,
  isStockTokenVariantTradable,
} from '@onekeyhq/shared/src/utils/stockTokenVariant';
import {
  equalTokenNoCaseSensitive,
  normalizeTokenContractAddress,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

export {
  getDefaultStockTokenVariant,
  isStockTokenVariantTradable,
} from '@onekeyhq/shared/src/utils/stockTokenVariant';

/**
 * The variant a stock detail opens on: the tradable variant the route names,
 * otherwise the stock's default tradable variant.
 */
export function resolveStockTokenVariantSelection({
  variants,
  defaultTokenId,
  routeNetworkId,
  routeTokenAddress,
}: {
  variants: IMarketStockTokenVariant[];
  defaultTokenId?: string;
  routeNetworkId?: string;
  routeTokenAddress?: string;
}) {
  const routeToken = variants.find(
    (item) =>
      isStockTokenVariantTradable(item) &&
      equalTokenNoCaseSensitive({
        token1: {
          networkId: item.networkId,
          contractAddress: item.contractAddress,
        },
        token2: {
          networkId: routeNetworkId,
          contractAddress: routeTokenAddress,
        },
      }),
  );
  return routeToken ?? getDefaultStockTokenVariant(variants, defaultTokenId);
}
/**
 * Identity a portfolio balance lookup is keyed on. Lives here rather than
 * beside the fetch so a component can ask whether a variant's balance was
 * established without pulling the background proxy in with it.
 */
export function getStockPortfolioVariantKey(variant: IMarketStockTokenVariant) {
  const contractAddress =
    normalizeTokenContractAddress({
      networkId: variant.networkId,
      contractAddress: variant.contractAddress,
    }) ?? variant.contractAddress;
  return `${variant.networkId}:${contractAddress}`;
}

export function getStockTokenVariantActionIdentity(
  variant?: IMarketStockTokenVariant,
) {
  if (!variant?.networkId?.trim() || !variant.contractAddress?.trim()) {
    return undefined;
  }

  return {
    networkId: variant.networkId,
    address: variant.contractAddress,
    symbol: variant.symbol,
  };
}
