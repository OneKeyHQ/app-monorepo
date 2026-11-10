import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { requireMarketAssetVariant } from '@onekeyhq/shared/src/utils/marketAssetVariant';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IMarketAssetListItem } from '@onekeyhq/shared/types/market';

function toFiniteNumber(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export async function resolveMarketTopCoinNavigationTarget(
  item: Pick<IMarketAssetListItem, 'assetId'> & {
    preferredToken?: {
      networkId: string;
      tokenAddress: string;
      isNative?: boolean;
    };
  },
) {
  const { preferredToken } = item;
  const detail = await backgroundApiProxy.serviceMarket
    .fetchMarketAssetDetail({
      assetId: item.assetId,
      currency: 'usd',
      autoHandleError: false,
    })
    .catch((error: unknown) => {
      if (preferredToken) return undefined;
      throw error;
    });
  if (!detail) return undefined;
  const { asset, market } = detail;
  const selectedVariant = preferredToken
    ? requireMarketAssetVariant({ detail, ...preferredToken })
    : detail.selectedVariant;
  const networkInfo = selectedVariant?.networkId
    ? networkUtils.getLocalNetworkInfo(selectedVariant.networkId)
    : undefined;
  const hasTokenIdentity = Boolean(
    selectedVariant?.isNative || selectedVariant?.tokenAddress,
  );
  if (
    !selectedVariant?.networkId ||
    !hasTokenIdentity ||
    (!networkInfo && !preferredToken)
  ) {
    throw new OneKeyLocalError('Invalid market asset variant');
  }
  let decimals: number | undefined;
  if (selectedVariant.isNative) {
    decimals = networkInfo?.decimals;
  } else {
    try {
      const tokenInfo =
        await backgroundApiProxy.serviceToken.fetchTokenInfoOnly({
          networkId: selectedVariant.networkId,
          tokenAddress: selectedVariant.tokenAddress,
        });
      decimals = tokenInfo?.info?.decimals;
    } catch {
      decimals = undefined;
    }
  }
  if (
    typeof decimals !== 'number' ||
    !Number.isFinite(decimals) ||
    !Number.isInteger(decimals) ||
    decimals < 0
  ) {
    decimals = undefined;
  }
  return {
    address: selectedVariant.tokenAddress,
    change24h: toFiniteNumber(market.priceChange24hPercent),
    decimals,
    isNative: selectedVariant.isNative,
    marketCap: toFiniteNumber(market.marketCap),
    marketTokenId: asset.assetId,
    marketVariantId: selectedVariant.variantId,
    name: asset.name,
    networkId: selectedVariant.networkId,
    price: toFiniteNumber(market.price),
    symbol: asset.symbol.toUpperCase(),
    tokenAddress: selectedVariant.tokenAddress,
    tokenImageUri: asset.logoUrl,
    turnover: toFiniteNumber(market.volume24h),
  };
}
