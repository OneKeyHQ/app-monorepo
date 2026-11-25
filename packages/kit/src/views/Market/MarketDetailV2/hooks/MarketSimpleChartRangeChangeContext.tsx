import { createContext, useCallback, useContext, useState } from 'react';
import type { PropsWithChildren } from 'react';

import BigNumber from 'bignumber.js';

import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type {
  IStockSimpleChartRange,
  IStockSimpleChartRangeChange,
} from '../components/StockSimpleChart';

export type IReportedSimpleChartRange = IStockSimpleChartRangeChange & {
  widgetScope?: {
    assetId?: string;
    networkId: string;
    tokenAddress: string;
    observedAt: number;
  };
};

type IReportRangeChange = (
  change: IReportedSimpleChartRange | undefined,
) => void;

// Split so the chart, which only reports, does not re-render on its own report.
const RangeChangeValueContext = createContext<
  IStockSimpleChartRangeChange | undefined
>(undefined);
const WidgetRangeChangeContext = createContext<
  IReportedSimpleChartRange | undefined
>(undefined);
const RangeChangeReportContext = createContext<IReportRangeChange>(
  () => undefined,
);

function isSameRangeChange(
  a: IStockSimpleChartRangeChange | undefined,
  b: IStockSimpleChartRangeChange | undefined,
) {
  return (
    a?.priceMode === b?.priceMode &&
    a?.range === b?.range &&
    a?.session === b?.session &&
    a?.isTradingDay === b?.isTradingDay &&
    a?.baseline === b?.baseline &&
    a?.latest === b?.latest
  );
}

/**
 * Carries the simple chart's range move up to the price header, which sits in
 * a different branch of the detail layout. One provider per detail page, so a
 * retained route never shows another page's range.
 */
export function MarketSimpleChartRangeChangeProvider({
  children,
}: PropsWithChildren) {
  const [change, setChange] = useState<IStockSimpleChartRangeChange>();
  const [widgetChange, setWidgetChange] = useState<IReportedSimpleChartRange>();
  const report = useCallback<IReportRangeChange>((next) => {
    setChange((prev) => (isSameRangeChange(prev, next) ? prev : next));
    setWidgetChange(
      next?.widgetScope && next.range === '1D' ? next : undefined,
    );
  }, []);
  return (
    <RangeChangeReportContext.Provider value={report}>
      <RangeChangeValueContext.Provider value={change}>
        <WidgetRangeChangeContext.Provider value={widgetChange}>
          {children}
        </WidgetRangeChangeContext.Provider>
      </RangeChangeValueContext.Provider>
    </RangeChangeReportContext.Provider>
  );
}

export function useReportMarketSimpleChartRangeChange() {
  return useContext(RangeChangeReportContext);
}

export function useReportedMarketSimpleChartRange() {
  return useContext(WidgetRangeChangeContext);
}

/**
 * The range move to show in place of the 24h figures, or undefined while the
 * simple chart has no series (Pro mode, loading, error, empty). A move measured
 * on the other price source is ignored, so a mode switch never pairs one
 * source's price with the other's change.
 */
export function useMarketSimpleChartRangePriceChange(
  priceMode: IMarketPriceSource,
) {
  return getMarketSimpleChartRangePriceChange(
    useContext(RangeChangeValueContext),
    priceMode,
  );
}

export function getMarketSimpleChartRangePriceChange(
  change: IStockSimpleChartRangeChange | undefined,
  priceMode: IMarketPriceSource,
):
  | {
      priceChangePercent: string;
      priceChangeValue: string;
    }
  | undefined {
  if (!change || change.priceMode !== priceMode) {
    return undefined;
  }
  const difference = new BigNumber(change.latest).minus(change.baseline);
  return {
    priceChangePercent: difference
      .dividedBy(change.baseline)
      .multipliedBy(100)
      .toFixed(),
    priceChangeValue: difference.toFixed(),
  };
}

const RANGE_CHANGE_LABEL_IDS: Record<IStockSimpleChartRange, ETranslations> = {
  '1H': ETranslations.market_range_change_past_hour,
  '1D': ETranslations.market_range_change_past_24h,
  '1W': ETranslations.market_range_change_past_week,
  '1M': ETranslations.market_range_change_past_month,
  '1Y': ETranslations.market_range_change_past_year,
  '5Y': ETranslations.market_range_change_past_5_years,
  All: ETranslations.market_range_change_all_time,
};

/**
 * Names the window the header's move covers. A share's trading day is measured
 * from the previous close, both on the simple chart's sessions and in the 24h
 * figures the header falls back to, so it reads "Today". The share's 1D range
 * and a tokenized price's day are a rolling 24 hours.
 */
export function useMarketPriceChangeLabelId(
  priceMode: IMarketPriceSource,
): ETranslations {
  return getMarketPriceChangeLabelId(
    useContext(RangeChangeValueContext),
    priceMode,
  );
}

export function getMarketPriceChangeLabelId(
  change: IStockSimpleChartRangeChange | undefined,
  priceMode: IMarketPriceSource,
): ETranslations {
  const current = change && change.priceMode === priceMode ? change : undefined;
  if (
    priceMode === 'share' &&
    (!current || current.session || current.isTradingDay)
  ) {
    return ETranslations.date_today;
  }
  return RANGE_CHANGE_LABEL_IDS[current?.range ?? '1D'];
}
