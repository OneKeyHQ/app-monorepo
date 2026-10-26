import type { ITradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { getTradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource';
import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

type IGetTradingViewNativeSourceParams = Parameters<
  typeof getTradingViewNativeSource
>[0];

export function getMarketDetailTradingViewNativeSource({
  stockId,
  priceMode,
  ...params
}: IGetTradingViewNativeSourceParams & {
  stockId?: string;
  priceMode?: IMarketPriceSource;
}): ITradingViewNativeSource {
  if (priceMode === 'share' && stockId) {
    return { kind: 'stock', stockId };
  }
  return getTradingViewNativeSource({
    ...params,
    hyperliquidWhitelistBranch: 'market',
  });
}
