import { getTradingViewNativeSource } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/getTradingViewNativeSource';

type IGetTradingViewNativeSourceParams = Parameters<
  typeof getTradingViewNativeSource
>[0];

export function getMarketDetailTradingViewNativeSource(
  params: IGetTradingViewNativeSourceParams,
) {
  return getTradingViewNativeSource({
    ...params,
    hyperliquidWhitelistBranch: 'market',
  });
}
