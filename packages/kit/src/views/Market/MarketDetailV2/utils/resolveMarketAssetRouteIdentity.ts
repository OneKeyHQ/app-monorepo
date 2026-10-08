import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MARKET_TOP_COINS_CATEGORY_ID } from '@onekeyhq/shared/src/consts/marketConsts';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketAssetVariant } from '@onekeyhq/shared/types/market';

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

function isSameMarketVariant({
  networkId,
  tokenAddress,
  isNative,
  variant,
}: Omit<IResolveMarketAssetRouteIdentityParams, 'symbol'> & {
  variant: IMarketAssetVariant;
}) {
  if (variant.isNative !== Boolean(isNative)) {
    return false;
  }
  if (variant.isNative) {
    return variant.networkId === networkId;
  }
  return equalTokenNoCaseSensitive({
    token1: {
      networkId,
      contractAddress: tokenAddress,
    },
    token2: {
      networkId: variant.networkId,
      contractAddress: variant.tokenAddress,
    },
  });
}

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
        const variants = [detail.selectedVariant, ...detail.variants];
        const matchedVariant = variants.find(
          (variant) =>
            variant &&
            isSameMarketVariant({
              networkId,
              tokenAddress,
              isNative,
              variant,
            }),
        );

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
