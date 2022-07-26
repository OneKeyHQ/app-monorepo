import axios from 'axios';
import {
  BusinessDay,
  ChartOptions,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer X)[]
    ? readonly DeepPartial<X>[]
    : DeepPartial<T[P]>;
};

type PriceNumber = number;
type TimeNumber = number;
export type MarketApiData = [TimeNumber, PriceNumber];

export type OnHoverFunction = ({
  time,
  price,
}: {
  time?: UTCTimestamp | BusinessDay | Date | string;
  price?: number | string;
}) => void;
export interface ChartViewProps {
  data: MarketApiData[];
  onHover: OnHoverFunction;
  height: number;
  isFetching: boolean;
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
  data: MarketApiData[];
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

const marketApi = 'https://fiat.onekeycn.com/market/chart';

interface MarketData {
  prices: [number, number][];
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
    result = res.data.prices;
    // eslint-disable-next-line no-empty
  } catch (e) {}
  return result;
};
