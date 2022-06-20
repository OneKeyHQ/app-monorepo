import { IChartApi, createChart } from 'lightweight-charts';

export function createChartDom(
  domNode: HTMLDivElement,
  onHover: (price: number) => void,
) {
  const chart = createChart(domNode, {
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
