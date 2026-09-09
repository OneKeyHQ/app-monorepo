import type { IMarketStockTokenVariant } from '@onekeyhq/shared/types/marketV2';

export {
  getDefaultStockTokenVariant,
  isStockTokenVariantTradable,
} from '@onekeyhq/shared/src/utils/stockTokenVariant';

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
