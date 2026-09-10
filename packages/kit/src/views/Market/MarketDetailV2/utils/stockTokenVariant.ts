import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

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

export function isStockTokenVariantTradable(variant: IMarketStockTokenVariant) {
  return Boolean(
    variant.tradingEnabled &&
    !variant.isPaused &&
    !variant.tradingHours?.isPaused &&
    variant.status.trim().toLowerCase() === 'active',
  );
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

export function getDefaultStockTokenVariant(
  items: IMarketStockTokenVariant[],
  defaultTokenId?: string,
) {
  return (
    items.find(
      (item) =>
        item.tokenId === defaultTokenId && isStockTokenVariantTradable(item),
    ) ?? items.find(isStockTokenVariantTradable)
  );
}
