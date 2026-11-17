// cspell:words heikin ashi
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type {
  ITradingViewNativeChartType,
  ITradingViewNativeChartTypePreference,
} from '@onekeyhq/shared/types/tradingViewNative';

import type { ITradingViewChartTypeOption } from '../../TradingViewChartControls';
import type { IMarketKLinePointType } from '../../utils/fetchMarketKLineData';

export type ITradingViewNativePrimarySeriesRenderKind =
  | 'bars'
  | 'candles'
  | 'line';
export type ITradingViewNativePrimarySeriesPointTransform =
  | 'heikinAshi'
  | 'identity';
export type ITradingViewNativePrimarySeriesColorRole =
  | 'directional'
  | 'line'
  | 'up';
export type ITradingViewNativePrimarySeriesPriceSource = 'close' | 'ohlc';

export interface ITradingViewNativePrimarySeriesModel {
  colorRole: ITradingViewNativePrimarySeriesColorRole;
  fillArea: boolean;
  pointTransform: ITradingViewNativePrimarySeriesPointTransform;
  priceSource: ITradingViewNativePrimarySeriesPriceSource;
  renderKind: ITradingViewNativePrimarySeriesRenderKind;
}

type ITradingViewNativeChartTypeDefinitions = {
  [TChartType in ITradingViewNativeChartType]: {
    option: ITradingViewChartTypeOption & { id: TChartType };
    primarySeries: ITradingViewNativePrimarySeriesModel;
  };
};

const TRADING_VIEW_NATIVE_CHART_TYPE_DEFINITIONS = {
  candlestick: {
    option: { id: 'candlestick', label: 'Candles', value: 1 },
    primarySeries: {
      colorRole: 'directional',
      fillArea: false,
      pointTransform: 'identity',
      priceSource: 'ohlc',
      renderKind: 'candles',
    },
  },
  heikinAshi: {
    option: { id: 'heikinAshi', label: 'Heikin Ashi', value: 8 },
    primarySeries: {
      colorRole: 'directional',
      fillArea: false,
      pointTransform: 'heikinAshi',
      priceSource: 'ohlc',
      renderKind: 'candles',
    },
  },
  bars: {
    option: { id: 'bars', label: 'Bars', value: 0 },
    primarySeries: {
      colorRole: 'directional',
      fillArea: false,
      pointTransform: 'identity',
      priceSource: 'ohlc',
      renderKind: 'bars',
    },
  },
  line: {
    option: { id: 'line', label: 'Line', value: 2 },
    primarySeries: {
      colorRole: 'line',
      fillArea: false,
      pointTransform: 'identity',
      priceSource: 'close',
      renderKind: 'line',
    },
  },
  area: {
    option: { id: 'area', label: 'Area', value: 3 },
    primarySeries: {
      colorRole: 'up',
      fillArea: true,
      pointTransform: 'identity',
      priceSource: 'close',
      renderKind: 'line',
    },
  },
} as const satisfies ITradingViewNativeChartTypeDefinitions;

const TRADING_VIEW_NATIVE_CHART_TYPES_BY_VALUE = new Map<
  number,
  ITradingViewNativeChartType
>(
  Object.values(TRADING_VIEW_NATIVE_CHART_TYPE_DEFINITIONS).map(
    ({ option }) => [option.value, option.id] as const,
  ),
);

export const TRADING_VIEW_NATIVE_CHART_TYPE_OPTIONS = Object.values(
  TRADING_VIEW_NATIVE_CHART_TYPE_DEFINITIONS,
).map(({ option }) => option);

export function getTradingViewNativePrimarySeriesModel(
  chartType: ITradingViewNativeChartType,
): ITradingViewNativePrimarySeriesModel {
  'worklet';

  return TRADING_VIEW_NATIVE_CHART_TYPE_DEFINITIONS[chartType].primarySeries;
}

export function getTradingViewNativeChartType({
  hasSingleValueHistory,
  pointCount,
}: {
  hasSingleValueHistory: boolean;
  pointCount: number;
}): ITradingViewNativeChartType {
  return hasSingleValueHistory || pointCount === 1 ? 'line' : 'candlestick';
}

export function isTradingViewNativeSingleValueHistory(
  pointType?: IMarketKLinePointType,
) {
  return pointType === 'single';
}

export function isTradingViewNativeChartTypePreference(
  value: unknown,
): value is ITradingViewNativeChartTypePreference {
  return (
    value === 'auto' ||
    (typeof value === 'string' &&
      Object.prototype.hasOwnProperty.call(
        TRADING_VIEW_NATIVE_CHART_TYPE_DEFINITIONS,
        value,
      ))
  );
}

export function getTradingViewNativeChartTypeValue(
  chartType: ITradingViewNativeChartType,
): number {
  return TRADING_VIEW_NATIVE_CHART_TYPE_DEFINITIONS[chartType].option.value;
}

export function getTradingViewNativeChartTypeFromValue(
  value: number,
): ITradingViewNativeChartType | undefined {
  return TRADING_VIEW_NATIVE_CHART_TYPES_BY_VALUE.get(value);
}

export function resolveTradingViewNativeChartType({
  automaticChartType,
  preference,
}: {
  automaticChartType: ITradingViewNativeChartType;
  preference: ITradingViewNativeChartTypePreference;
}): ITradingViewNativeChartType {
  return preference === 'auto' ? automaticChartType : preference;
}

export function getTradingViewNativeRenderDataRevision({
  chartPictureVersion,
  chartType,
}: {
  chartPictureVersion: number;
  chartType: ITradingViewNativeChartType;
}): string {
  const { pointTransform } = getTradingViewNativePrimarySeriesModel(chartType);
  return `${chartPictureVersion.toString()}:${pointTransform}`;
}

export function getTradingViewNativePrimarySeriesPoints({
  chartType,
  points,
}: {
  chartType: ITradingViewNativeChartType;
  points: IMarketTokenKLineDataPoint[];
}): IMarketTokenKLineDataPoint[] {
  const { pointTransform } = getTradingViewNativePrimarySeriesModel(chartType);
  if (pointTransform === 'identity') {
    return points;
  }

  let previousOpen: number | undefined;
  let previousClose: number | undefined;
  return points.map((point) => {
    if (
      !Number.isFinite(point.o) ||
      !Number.isFinite(point.h) ||
      !Number.isFinite(point.l) ||
      !Number.isFinite(point.c)
    ) {
      previousOpen = undefined;
      previousClose = undefined;
      return point;
    }

    const close = (point.o + point.h + point.l + point.c) / 4;
    const open =
      previousOpen === undefined || previousClose === undefined
        ? (point.o + point.c) / 2
        : (previousOpen + previousClose) / 2;
    const nextPoint = {
      ...point,
      c: close,
      h: Math.max(point.h, open, close),
      l: Math.min(point.l, open, close),
      o: open,
    };
    previousOpen = open;
    previousClose = close;
    return nextPoint;
  });
}
