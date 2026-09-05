import { useCallback, useMemo, useState } from 'react';

import type { ITableColumn } from '@onekeyhq/components';

import {
  MARKET_LIST_FIRST_COLUMN_MAX_WIDTH,
  MARKET_LIST_FIRST_COLUMN_MIN_WIDTH,
  MARKET_LIST_METRIC_COLUMN_MIN_WIDTH,
} from '../../marketDesktopLayoutConstants';

import type { LayoutChangeEvent } from 'react-native';

type IMarketDesktopResponsiveLayout = {
  firstColumnWidth: number;
  visibleMetricColumnCount: number;
};

export function getMarketDesktopResponsiveLayout({
  containerWidth,
  metricColumnCount,
  metricColumnMinimumWidths,
  minimumVisibleMetricColumnCount = 1,
}: {
  containerWidth: number;
  metricColumnCount: number;
  metricColumnMinimumWidths?: readonly number[];
  minimumVisibleMetricColumnCount?: number;
}): IMarketDesktopResponsiveLayout {
  if (containerWidth <= 0 || metricColumnCount <= 0) {
    return {
      firstColumnWidth: MARKET_LIST_FIRST_COLUMN_MAX_WIDTH,
      visibleMetricColumnCount: metricColumnCount,
    };
  }

  const minimumVisibleCount = Math.min(
    Math.max(0, minimumVisibleMetricColumnCount),
    metricColumnCount,
  );
  let visibleMetricColumnCount = metricColumnCount;
  const resolvedMetricColumnMinimumWidths = Array.from(
    { length: metricColumnCount },
    (_, index) =>
      metricColumnMinimumWidths?.[index] ?? MARKET_LIST_METRIC_COLUMN_MIN_WIDTH,
  );
  const getVisibleMetricColumnsMinimumWidth = (visibleCount: number) =>
    resolvedMetricColumnMinimumWidths
      .slice(0, visibleCount)
      .reduce((total, width) => total + width, 0);

  while (
    visibleMetricColumnCount > minimumVisibleCount &&
    containerWidth <
      MARKET_LIST_FIRST_COLUMN_MIN_WIDTH +
        getVisibleMetricColumnsMinimumWidth(visibleMetricColumnCount)
  ) {
    visibleMetricColumnCount -= 1;
  }

  const didHideMetricColumns = visibleMetricColumnCount < metricColumnCount;
  const availableFirstColumnWidth =
    containerWidth -
    getVisibleMetricColumnsMinimumWidth(visibleMetricColumnCount);
  const firstColumnWidth = didHideMetricColumns
    ? MARKET_LIST_FIRST_COLUMN_MIN_WIDTH
    : Math.min(
        MARKET_LIST_FIRST_COLUMN_MAX_WIDTH,
        Math.max(MARKET_LIST_FIRST_COLUMN_MIN_WIDTH, availableFirstColumnWidth),
      );

  return { firstColumnWidth, visibleMetricColumnCount };
}

export function buildMarketDesktopResponsiveColumns<T>({
  columns,
  firstColumnCount,
  firstColumnWidth,
  metricColumnMinimumWidths,
  visibleMetricColumnCount,
}: {
  columns: ITableColumn<T>[];
  firstColumnCount: number;
  firstColumnWidth: number;
  metricColumnMinimumWidths?: Readonly<Record<string, number>>;
  visibleMetricColumnCount: number;
}): ITableColumn<T>[] {
  const firstColumns = columns.slice(0, firstColumnCount);
  const metricColumns = columns
    .slice(firstColumnCount, firstColumnCount + visibleMetricColumnCount)
    .map((column) => ({
      ...column,
      columnProps: {
        ...column.columnProps,
        minWidth:
          metricColumnMinimumWidths?.[column.dataIndex] ??
          MARKET_LIST_METRIC_COLUMN_MIN_WIDTH,
      },
    }));

  if (firstColumns.length === 0) {
    return metricColumns;
  }

  const fixedPrefixWidth = firstColumns
    .slice(0, -1)
    .reduce(
      (total, column) =>
        total +
        (typeof column.columnWidth === 'number' ? column.columnWidth : 0),
      0,
    );
  const lastFirstColumnIndex = firstColumns.length - 1;
  const resizedFirstColumns = firstColumns.map((column, index) =>
    index === lastFirstColumnIndex
      ? {
          ...column,
          columnWidth: Math.max(0, firstColumnWidth - fixedPrefixWidth),
          columnProps: {
            ...column.columnProps,
            flexGrow: 0,
            flexShrink: 0,
          },
        }
      : column,
  );

  return [...resizedFirstColumns, ...metricColumns];
}

export function useMarketDesktopResponsiveColumns<T>({
  columns,
  enabled,
  firstColumnCount,
  horizontalInset = 0,
  metricColumnMinimumWidths,
  minimumVisibleMetricColumnCount = 1,
}: {
  columns: ITableColumn<T>[];
  enabled: boolean;
  firstColumnCount: number;
  horizontalInset?: number;
  metricColumnMinimumWidths?: Readonly<Record<string, number>>;
  minimumVisibleMetricColumnCount?: number;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    setContainerWidth((currentWidth) =>
      currentWidth === nextWidth ? currentWidth : nextWidth,
    );
  }, []);

  const layout = useMemo(() => {
    const metricColumns = columns.slice(firstColumnCount);
    return getMarketDesktopResponsiveLayout({
      containerWidth: Math.max(0, containerWidth - horizontalInset),
      metricColumnCount: metricColumns.length,
      metricColumnMinimumWidths: metricColumns.map(
        (column) =>
          metricColumnMinimumWidths?.[column.dataIndex] ??
          MARKET_LIST_METRIC_COLUMN_MIN_WIDTH,
      ),
      minimumVisibleMetricColumnCount,
    });
  }, [
    columns,
    containerWidth,
    firstColumnCount,
    horizontalInset,
    metricColumnMinimumWidths,
    minimumVisibleMetricColumnCount,
  ]);
  const responsiveColumns = useMemo(
    () =>
      enabled
        ? buildMarketDesktopResponsiveColumns({
            columns,
            firstColumnCount,
            firstColumnWidth: layout.firstColumnWidth,
            metricColumnMinimumWidths,
            visibleMetricColumnCount: layout.visibleMetricColumnCount,
          })
        : columns,
    [columns, enabled, firstColumnCount, layout, metricColumnMinimumWidths],
  );

  return {
    columns: responsiveColumns,
    firstColumnWidth: layout.firstColumnWidth,
    handleContainerLayout,
    visibleMetricColumnCount: layout.visibleMetricColumnCount,
  };
}
