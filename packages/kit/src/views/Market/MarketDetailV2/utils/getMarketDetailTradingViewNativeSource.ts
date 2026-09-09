import { getTradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource';

type IGetTradingViewNativeSourceParams = Parameters<
  typeof getTradingViewNativeSource
>[0];

export function getMarketDetailTradingViewNativeSource(
  params: IGetTradingViewNativeSourceParams & { marketAssetId?: string },
) {
  const { marketAssetId, ...sourceParams } = params;
  if (marketAssetId) {
    return { kind: 'asset' as const, assetId: marketAssetId };
  }
  return getTradingViewNativeSource({
    ...sourceParams,
    hyperliquidWhitelistBranch: 'market',
  });
}
