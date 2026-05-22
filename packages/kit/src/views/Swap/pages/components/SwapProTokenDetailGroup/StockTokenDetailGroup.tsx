import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { SwapProTokenDetailRows } from './SwapProTokenDetailRows';
import {
  renderCurrencyValue,
  renderPercentValue,
  renderRatioValue,
} from './valueRenderers';

export type IStockTokenDetail = IMarketTokenDetail & {
  stock: NonNullable<IMarketTokenDetail['stock']>;
};

export function StockTokenDetailGroup({
  tokenDetail,
}: {
  tokenDetail: IStockTokenDetail;
}) {
  const { stock } = tokenDetail;

  return (
    <SwapProTokenDetailRows
      rows={[
        {
          titleId: ETranslations.dexmarket_market_cap,
          valueComponent: renderCurrencyValue(
            stock.marketCap ?? tokenDetail.marketCap,
          ),
        },
        {
          titleId: ETranslations.dexmarket_stock_24h_volume,
          valueComponent: renderCurrencyValue(
            stock.assetAnalysis?.volume24h ?? tokenDetail.volume24h,
            { forceMarketCapFormatter: true },
          ),
        },
        {
          titleId: ETranslations.dexmarket_stock_pe_ttm,
          valueComponent: renderRatioValue(stock.tradingActivity?.peRatio),
        },
        {
          titleId: ETranslations.dexmarket_stock_turnover_rate,
          valueComponent: renderPercentValue(stock.assetAnalysis?.turnoverRate),
        },
      ]}
    />
  );
}
