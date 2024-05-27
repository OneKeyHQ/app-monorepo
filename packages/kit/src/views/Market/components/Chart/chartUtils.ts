import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import type {
  BusinessDay,
  ChartOptions,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';

type IDeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? IDeepPartial<U>[]
    : T[P] extends readonly (infer X)[]
    ? readonly IDeepPartial<X>[]
    : IDeepPartial<T[P]>;
};

type IPriceNumber = number;
type ITimeNumber = number;

export type IOnHoverFunction = ({
  time,
  price,
}: {
  time?: UTCTimestamp | BusinessDay | Date | string;
  price?: number | string;
}) => void;
export interface IChartViewProps {
  data: IMarketTokenChart;
  onHover: IOnHoverFunction;
  height: number;
  isFetching: boolean;
}

export interface IChartViewAdapterProps extends IChartViewProps {
  lineColor: string;
  topColor: string;
  bottomColor: string;
}

interface IOnekeyChartApi extends IChartApi {
  // eslint-disable-next-line camelcase
  _onekey_series?: ISeriesApi<'Area'>;
}
export function createChartDom(
  createChartFunc: (
    container: HTMLElement,
    options?: IDeepPartial<ChartOptions>,
  ) => IChartApi,
  domNode: HTMLElement,
  onHover: IOnHoverFunction,
  height: number,
) {
  const chart = createChartFunc(domNode, {
    height,
    layout: {
      background: {
        color: 'transparent',
      },
    },
    crosshair: {
      vertLine: { visible: false },
      horzLine: { visible: false },
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    timeScale: {
      visible: false,
      fixLeftEdge: true,
      fixRightEdge: true,
      lockVisibleTimeRangeOnResize: true,
    },
    rightPriceScale: {
      visible: false,
    },
    handleScale: {
      pinch: false,
      mouseWheel: false,
    },
  });
  const handleResize = () => {
    chart.applyOptions({ width: domNode.clientWidth });
  };
  chart.subscribeCrosshairMove(({ time, seriesPrices }) => {
    onHover({ time, price: seriesPrices.values().next().value });
  });
  chart.timeScale().fitContent();
  window.addEventListener('resize', handleResize);
  // @ts-ignore
  window._onekey_chart = chart;
  return { chart, handleResize };
}

export function updateChartDom({
  lineColor,
  topColor,
  bottomColor,
  data,
}: {
  lineColor: string;
  topColor: string;
  bottomColor: string;
  data: IMarketTokenChart;
}) {
  const formattedData = (data as [UTCTimestamp, number][]).map(
    ([time, value]) => ({
      time,
      value,
    }),
  );
  // @ts-ignore
  const chart = window._onekey_chart as IOnekeyChartApi;
  if (!chart._onekey_series) {
    const newSeries = chart.addAreaSeries({
      lineColor,
      topColor,
      bottomColor,
      lineWidth: 2,
      crosshairMarkerBorderColor: '#fff',
      crosshairMarkerRadius: 5,
    });
    newSeries.setData(formattedData);
    chart._onekey_series = newSeries;
    return;
  }
  const series = chart._onekey_series;
  series.applyOptions({ lineColor, topColor, bottomColor });
  series.setData(formattedData);

  if (data.length > 2) {
    chart
      .timeScale()
      // https://github.com/tradingview/lightweight-charts/issues/1015
      .setVisibleLogicalRange({ from: 0.4, to: data.length - 1.4 });
  }
}

export type IPriceApiProps = {
  networkId: string;
  contract?: string;
  'vs_currency'?: string;
  days: string;
  points?: string;
};
