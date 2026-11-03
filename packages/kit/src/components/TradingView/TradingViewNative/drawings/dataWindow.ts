import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import type { ITradingViewNativeIndicatorSeries } from '../utils/chartIndicators';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

export type IDataWindowSnapshot = {
  time: number;
  historical: boolean;
  // `name` stays stable for keys and test IDs; `labelId` is the display copy.
  groups: {
    name: string;
    labelId?: ETranslations;
    rows: { name: string; labelId?: ETranslations; value: number | null }[];
  }[];
};

export function getDataWindowSnapshot({
  points,
  pointIndex,
  indicatorSeries,
  subIndicatorPanes,
}: {
  points: IMarketTokenKLineDataPoint[];
  pointIndex: number | null;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  subIndicatorPanes: readonly ITradingViewNativeSubIndicatorRenderPane[];
}): IDataWindowSnapshot | null {
  const index = pointIndex ?? points.length - 1;
  const point = points[index];
  if (!point) return null;
  const previous = points[index - 1];
  return {
    time: point.t,
    historical: pointIndex !== null,
    groups: [
      {
        name: 'Price',
        labelId: ETranslations.global_price,
        rows: [
          {
            name: 'Open',
            labelId: ETranslations.market_chart_indicator_source_open__option,
            value: point.o,
          },
          {
            name: 'High',
            labelId: ETranslations.market_drawing_high__title,
            value: point.h,
          },
          {
            name: 'Low',
            labelId: ETranslations.market_drawing_low__title,
            value: point.l,
          },
          {
            name: 'Close',
            labelId: ETranslations.market_chart_indicator_source_close__option,
            value: point.c,
          },
          {
            name: 'Change',
            labelId: ETranslations.market_stock_change__title,
            value: previous ? point.c - previous.c : null,
          },
          {
            name: 'Change %',
            labelId: ETranslations.market_drawing_change_percent__title,
            value: previous?.c
              ? ((point.c - previous.c) / previous.c) * 100
              : null,
          },
          {
            name: 'Volume',
            labelId: ETranslations.market_chart_indicator_vol__title,
            value: point.v ?? null,
          },
        ],
      },
      ...indicatorSeries
        .filter((series) => series.visible !== false)
        .map((series) => ({
          name: series.legendLabel ?? series.indicator,
          rows: [
            {
              name: series.legendLabel ?? series.indicator,
              value: series.values[index] ?? null,
            },
          ],
        })),
      ...subIndicatorPanes
        .filter((pane) => pane.isVisible)
        .map((pane) => ({
          name: pane.shortTitle,
          rows: pane.series
            .filter((series) => series.style.visible)
            .map((series) => ({
              name: series.title,
              value: series.values[index] ?? null,
            })),
        })),
    ],
  };
}
