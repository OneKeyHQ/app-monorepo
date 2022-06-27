import axios from 'axios';
import {
  BusinessDay,
  ChartOptions,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';
import { StyleProp, ViewStyle } from 'react-native';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer X)[]
    ? readonly DeepPartial<X>[]
    : DeepPartial<T[P]>;
};

export type OnHoverFunction = ({
  time,
  price,
}: {
  time?: UTCTimestamp | BusinessDay;
  price?: number;
}) => void;
export interface ChartViewProps {
  data: any[];
  onHover: OnHoverFunction;
  height: number;
}

export interface ChartViewAdapterProps extends ChartViewProps {
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
    options?: DeepPartial<ChartOptions>,
  ) => IChartApi,
  domNode: HTMLElement,
  onHover: OnHoverFunction,
  height: number,
) {
  const chart = createChartFunc(domNode, {
    height,
    layout: {
      background: {
        color: 'transparent',
      },
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
  data: any[];
}) {
  // @ts-ignore
  const chart = window._onekey_chart as IOnekeyChartApi;
  if (!chart._onekey_series) {
    const newSeries = chart.addAreaSeries({
      lineColor,
      topColor,
      bottomColor,
    });
    newSeries.setData(data);
    chart._onekey_series = newSeries;
    return;
  }
  const series = chart._onekey_series;
  series.applyOptions({ lineColor, topColor, bottomColor });
  series.setData(data);

  if (data.length > 2) {
    chart
      .timeScale()
      // https://github.com/tradingview/lightweight-charts/issues/1015
      .setVisibleLogicalRange({ from: 0.4, to: data.length - 1.4 });
  }
}

const marketApi = 'https://fiat.onekey.so/market';

interface MarketData {
  data: {
    prices: [number, number][];
  };
}

export type PriceApiProps = {
  platform?: string;
  contract?: string;
  'vs_currency'?: string;
  days: string;
};
export const fetchHistoricalPrices = async ({
  platform = 'ethereum',
  contract,
  // eslint-disable-next-line camelcase
  vs_currency = 'usd',
  days,
}: PriceApiProps) => {
  const params = new URLSearchParams({
    platform,
    days,
    vs_currency,
  });
  if (contract) {
    params.append('contract', contract);
  }
  let result: [number, number][] = [];
  try {
    const res = await axios.get<MarketData>(
      `${marketApi}?${params.toString()}`,
    );
    result = res.data.data.prices;
    // eslint-disable-next-line no-empty
  } catch (e) {}
  return result;
};
