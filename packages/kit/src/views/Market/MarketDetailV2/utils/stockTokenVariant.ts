import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

export {
  getDefaultStockTokenVariant,
  isStockTokenVariantTradable,
} from '@onekeyhq/shared/src/utils/stockTokenVariant';
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
