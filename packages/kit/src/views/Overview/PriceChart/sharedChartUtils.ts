import { ChartOptions, IChartApi, ISeriesApi } from 'lightweight-charts';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer X)[]
    ? readonly DeepPartial<X>[]
    : DeepPartial<T[P]>;
};

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
  onHover: (price?: number) => void,
  dataLength: number,
) {
  const chart = createChartFunc(domNode, {
    height: 300,
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

  chart
    .timeScale()
    // https://github.com/tradingview/lightweight-charts/issues/1015
    .setVisibleLogicalRange({ from: 0.4, to: dataLength - 1.4 });

  chart.subscribeCrosshairMove(({ seriesPrices }) => {
    onHover(seriesPrices.values().next().value);
  });

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
}
