import type { ITradingViewNativeSubIndicatorRenderPane } from '../utils/subIndicatorRender';

interface ITradingViewNativeSubIndicatorPanesPictureInput {
  chartPictureVersion: number;
  pointCount: number;
  structureKey: string;
}

interface ITradingViewNativeIndicatorSeriesPictureInput {
  chartPictureVersion: number;
  pointCount: number;
  seriesKey: string;
  settingsKey: string;
}

export interface ITradingViewNativeSubIndicatorLatestSeriesValue {
  key: string;
  paletteIndex?: number | null;
  value: number | null;
}

export interface ITradingViewNativeSubIndicatorLatestPaneValues {
  key: string;
  series: ITradingViewNativeSubIndicatorLatestSeriesValue[];
}

export interface ITradingViewNativeSubIndicatorPanesUpdate {
  latestPaneValues: ITradingViewNativeSubIndicatorLatestPaneValues[];
  replacementPanes: readonly ITradingViewNativeSubIndicatorRenderPane[] | null;
  structureKey: string;
}

export function shouldReplaceTradingViewNativeIndicatorSeries({
  current,
  previous,
}: {
  current: ITradingViewNativeIndicatorSeriesPictureInput;
  previous: ITradingViewNativeIndicatorSeriesPictureInput;
}) {
  return (
    previous.chartPictureVersion !== current.chartPictureVersion ||
    previous.pointCount !== current.pointCount ||
    previous.seriesKey !== current.seriesKey ||
    previous.settingsKey !== current.settingsKey
  );
}

function stableSerializeTradingViewNativeStructure(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return `array:[${value
      .map((item) => stableSerializeTradingViewNativeStructure(item))
      .join(',')}]`;
  }
  switch (typeof value) {
    case 'boolean':
      return value ? 'boolean:true' : 'boolean:false';
    case 'number':
      return `number:${value.toString()}`;
    case 'object': {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);
      for (let index = 1; index < keys.length; index += 1) {
        const current = keys[index];
        if (current !== undefined) {
          let insertIndex = index;
          while (insertIndex > 0 && (keys[insertIndex - 1] ?? '') > current) {
            keys[insertIndex] = keys[insertIndex - 1] ?? '';
            insertIndex -= 1;
          }
          keys[insertIndex] = current;
        }
      }
      return `object:{${keys
        .map(
          (key) =>
            `${stableSerializeTradingViewNativeStructure(
              key,
            )}:${stableSerializeTradingViewNativeStructure(record[key])}`,
        )
        .join(',')}}`;
    }
    case 'string':
      return `string:${value.length.toString()}:${value}`;
    case 'undefined':
      return 'undefined';
    default:
      return `${typeof value}:${String(value)}`;
  }
}

export function getTradingViewNativeSubIndicatorPanesStructureKey(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
): string {
  return stableSerializeTradingViewNativeStructure(
    panes.map((pane) => ({
      bands: pane.bands,
      fills: pane.fills,
      format: pane.format,
      indicator: pane.indicator,
      inputValues: pane.inputValues,
      instanceId: pane.instanceId,
      isVisible: pane.isVisible,
      key: pane.key,
      scale: pane.scale,
      series: pane.series.map((series) => ({
        id: series.id,
        key: series.key,
        paletteColors: series.palette?.colors ?? null,
        style: series.style,
        title: series.title,
        zOrder: series.zOrder,
      })),
      shortTitle: pane.shortTitle,
      title: pane.title,
    })),
  );
}

function getTradingViewNativeSubIndicatorLatestPaneValues(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
): ITradingViewNativeSubIndicatorLatestPaneValues[] {
  return panes.map((pane) => ({
    key: pane.key,
    series: pane.series.map((series) => ({
      key: series.key,
      paletteIndex: series.palette
        ? (series.palette.indexes[series.palette.indexes.length - 1] ?? null)
        : undefined,
      value: series.values[series.values.length - 1] ?? null,
    })),
  }));
}

export function getTradingViewNativeSubIndicatorPanesUpdate({
  current,
  panes,
  previous,
}: {
  current: ITradingViewNativeSubIndicatorPanesPictureInput;
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  previous: ITradingViewNativeSubIndicatorPanesPictureInput;
}): ITradingViewNativeSubIndicatorPanesUpdate {
  const shouldReplaceAllPanes =
    previous.chartPictureVersion !== current.chartPictureVersion ||
    previous.pointCount !== current.pointCount ||
    previous.structureKey !== current.structureKey;
  return {
    latestPaneValues: shouldReplaceAllPanes
      ? []
      : getTradingViewNativeSubIndicatorLatestPaneValues(panes),
    replacementPanes: shouldReplaceAllPanes ? panes : null,
    structureKey: current.structureKey,
  };
}

export function applyTradingViewNativeSubIndicatorLatestPaneValues({
  hasLatestPoint,
  latestPaneValues,
  panes,
}: {
  hasLatestPoint: boolean;
  latestPaneValues: readonly ITradingViewNativeSubIndicatorLatestPaneValues[];
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
}): readonly ITradingViewNativeSubIndicatorRenderPane[] {
  'worklet';

  if (panes.length !== latestPaneValues.length) {
    return panes;
  }
  for (let paneIndex = 0; paneIndex < panes.length; paneIndex += 1) {
    const pane = panes[paneIndex];
    const latestPane = latestPaneValues[paneIndex];
    if (
      pane.key !== latestPane?.key ||
      pane.series.length !== latestPane.series.length
    ) {
      return panes;
    }
    for (
      let seriesIndex = 0;
      seriesIndex < pane.series.length;
      seriesIndex += 1
    ) {
      const series = pane.series[seriesIndex];
      const latestSeries = latestPane.series[seriesIndex];
      if (
        series.key !== latestSeries?.key ||
        Boolean(series.palette) !== (latestSeries.paletteIndex !== undefined)
      ) {
        return panes;
      }
    }
  }

  // These arrays are UI-runtime-owned buffers. Updating their last slots keeps
  // same-candle realtime work constant instead of cloning full history.
  for (let paneIndex = 0; paneIndex < panes.length; paneIndex += 1) {
    const pane = panes[paneIndex];
    const latestPane = latestPaneValues[paneIndex];
    for (
      let seriesIndex = 0;
      seriesIndex < pane.series.length;
      seriesIndex += 1
    ) {
      const series = pane.series[seriesIndex];
      const latestSeries = latestPane.series[seriesIndex];
      if (hasLatestPoint) {
        const latestValueIndex = series.values.length - 1;
        if (latestValueIndex >= 0) {
          series.values[latestValueIndex] = latestSeries.value;
        }
        if (series.palette) {
          const latestPaletteIndex = series.palette.indexes.length - 1;
          if (latestPaletteIndex >= 0) {
            series.palette.indexes[latestPaletteIndex] =
              latestSeries.paletteIndex ?? null;
          }
        }
      } else {
        series.values.length = 0;
        if (series.palette) {
          series.palette.indexes.length = 0;
        }
      }
    }
  }
  return panes;
}
