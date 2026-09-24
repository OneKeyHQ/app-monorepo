import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import type { ITradingViewNativeIndicatorSeries } from '../utils/chartIndicators';
import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

export type IDataWindowSnapshot = {
  time: number;
  historical: boolean;
  groups: { name: string; rows: { name: string; value: number | null }[] }[];
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
        rows: [
          { name: 'Open', value: point.o },
          { name: 'High', value: point.h },
          { name: 'Low', value: point.l },
          { name: 'Close', value: point.c },
          { name: 'Change', value: previous ? point.c - previous.c : null },
          {
            name: 'Change %',
            value: previous?.c
              ? ((point.c - previous.c) / previous.c) * 100
              : null,
          },
          { name: 'Volume', value: point.v ?? null },
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
