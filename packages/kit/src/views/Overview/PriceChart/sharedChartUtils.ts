import { ChartOptions, IChartApi } from 'lightweight-charts';

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer X)[]
    ? readonly DeepPartial<X>[]
    : DeepPartial<T[P]>;
};
export function createChartDom(
  createChartFunc: (
    container: HTMLElement,
    options?: DeepPartial<ChartOptions>,
  ) => IChartApi,
  domNode: HTMLElement,
  onHover: (price?: number) => void,
) {
  const chart = createChartFunc(domNode, {
    height: 300,
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

  chart.timeScale().fitContent();

  chart.subscribeCrosshairMove(({ seriesPrices }) => {
    onHover(seriesPrices.values().next().value);
  });

  window.addEventListener('resize', handleResize);
  // @ts-ignore
  window._onekey_chart = chart;
  return { chart, handleResize };
}

export function updateChartDom({
  chart,
  lineColor,
  topColor,
  bottomColor,
  data,
}: {
  chart: IChartApi;
  lineColor: string;
  topColor: string;
  bottomColor: string;
  data: any[];
}) {
  const newSeries = chart.addAreaSeries({
    lineColor,
    topColor,
    bottomColor,
  });
  newSeries.setData(data);
}
