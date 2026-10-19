import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { resolveMarketAssetVariant } from '@onekeyhq/shared/src/utils/marketAssetVariant';

export type IMarketAssetRouteIdentity = {
  isNative: boolean;
  marketTokenId: string;
  marketVariantId: string;
  networkId: string;
  tokenAddress: string;
};

type IResolveMarketAssetRouteIdentityParams = {
  networkId: string;
  tokenAddress: string;
  symbol: string;
  isNative?: boolean;
};

export async function resolveMarketAssetRouteIdentity({
  networkId,
  tokenAddress,
  symbol,
  isNative,
}: IResolveMarketAssetRouteIdentityParams): Promise<
  IMarketAssetRouteIdentity | undefined
> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!networkId || !normalizedSymbol || (!tokenAddress && !isNative)) {
    return undefined;
  }

  try {
    const assetList =
      await backgroundApiProxy.serviceMarket.fetchMarketAssetList({
        currency: 'usd',
        limit: 100,
        page: 1,
        type: MARKET_TOP_COINS_CATEGORY_ID,
      });
    const candidates = assetList.list.filter(
      (asset) => asset.symbol.trim().toUpperCase() === normalizedSymbol,
    );

    for (const candidate of candidates) {
      try {
        const detail =
          await backgroundApiProxy.serviceMarket.fetchMarketAssetDetail({
            assetId: candidate.assetId,
            currency: 'usd',
          });
        const matchedVariant = resolveMarketAssetVariant({
          detail,
          networkId,
          tokenAddress,
          isNative,
        });

        if (matchedVariant) {
          return {
            isNative: matchedVariant.isNative,
            marketTokenId: detail.asset.assetId,
            marketVariantId: matchedVariant.variantId,
            networkId: matchedVariant.networkId,
            tokenAddress: matchedVariant.tokenAddress,
          };
        }
      } catch {
        // Continue checking same-symbol assets when one detail request fails.
      }
    }
  } catch {
    // Keep the existing token-detail route when Asset identity is unavailable.
  }

  return undefined;
}
