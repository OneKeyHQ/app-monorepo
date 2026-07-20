import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { Stack, useTheme, useThemeName } from '@onekeyhq/components';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_DOWN_COLOR as CHART_DOWN_COLOR,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_UP_COLOR as CHART_UP_COLOR,
  TRADING_VIEW_NATIVE_CROSSHAIR_LABEL_BACKGROUND_COLOR as CROSSHAIR_LABEL_BACKGROUND_COLOR,
  TRADING_VIEW_NATIVE_CROSSHAIR_LABEL_HEIGHT as CROSSHAIR_LABEL_HEIGHT,
  TRADING_VIEW_NATIVE_CROSSHAIR_LABEL_HORIZONTAL_PADDING as CROSSHAIR_LABEL_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CROSSHAIR_LABEL_TEXT_COLOR as CROSSHAIR_LABEL_TEXT_COLOR,
  TRADING_VIEW_NATIVE_CROSSHAIR_LINE_DASH_GAP as CROSSHAIR_LINE_DASH_GAP,
  TRADING_VIEW_NATIVE_CROSSHAIR_LINE_DASH_LENGTH as CROSSHAIR_LINE_DASH_LENGTH,
  TRADING_VIEW_NATIVE_CROSSHAIR_LINE_OPACITY as CROSSHAIR_LINE_OPACITY,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_HEIGHT as CURRENT_PRICE_LABEL_HEIGHT,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_TEXT_COLOR as CURRENT_PRICE_LABEL_TEXT_COLOR,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LINE_DASH_GAP as CURRENT_PRICE_LINE_DASH_GAP,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LINE_DASH_LENGTH as CURRENT_PRICE_LINE_DASH_LENGTH,
  TRADING_VIEW_NATIVE_GRID_LINE_DASH_GAP as GRID_LINE_DASH_GAP,
  TRADING_VIEW_NATIVE_GRID_LINE_DASH_LENGTH as GRID_LINE_DASH_LENGTH,
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_HORIZONTAL_PADDING as LEGEND_BACKGROUND_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_OPACITY as LEGEND_BACKGROUND_OPACITY,
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING as LEGEND_BACKGROUND_VERTICAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE as LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING as LEGEND_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_ITEM_GAP as LEGEND_ITEM_GAP,
  TRADING_VIEW_NATIVE_LEGEND_LABEL_VALUE_GAP as LEGEND_LABEL_VALUE_GAP,
  TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_RIGHT_PADDING as PRICE_AXIS_LABEL_RIGHT_PADDING,
  TRADING_VIEW_NATIVE_PRICE_LEGEND_TOP as PRICE_LEGEND_TOP,
  TRADING_VIEW_NATIVE_SWITCHING_INTERVAL_OPACITY as SWITCHING_INTERVAL_OPACITY,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT as TIME_AXIS_HEIGHT,
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
  TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
  TRADING_VIEW_NATIVE_VOLUME_LEGEND_TOP_PADDING as VOLUME_LEGEND_TOP_PADDING,
  TRADING_VIEW_NATIVE_VOLUME_OPACITY as VOLUME_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_DARK_OPACITY as WATERMARK_DARK_OPACITY,
  TRADING_VIEW_NATIVE_WATERMARK_LIGHT_OPACITY as WATERMARK_LIGHT_OPACITY,
} from '../chartConstants';
import {
  formatTradingViewNativeCrosshairTime,
  formatTradingViewNativePriceTick,
  getTradingViewNativeChartLayout,
  getTradingViewNativeChartWidth,
  getTradingViewNativeCurrentPriceLayout,
  getTradingViewNativePriceAtY,
  getTradingViewNativePriceY,
  getTradingViewNativeTimeTickMinimumIndexSpacing,
  getTradingViewNativeWatermarkLayout,
} from '../utils/chartLayout';
import {
  type ITradingViewNativeLegendItem,
  getTradingViewNativeChartLegend,
} from '../utils/chartLegend';
import { isTradingViewNativePriceUp } from '../utils/chartStyle';
import {
  type ITradingViewNativeVisiblePointRange,
  clampTradingViewNativePanOffset,
  clampTradingViewNativeZoomScale,
  getTradingViewNativeCandleX,
  getTradingViewNativeDataUpdateMetadata,
  getTradingViewNativePointIndexAtX,
  getTradingViewNativeViewportOffsetTransition,
  getTradingViewNativeVisiblePointRange,
  getTradingViewNativeZoomedViewport,
} from '../utils/chartViewport';

const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_DELTA_MODE_LINE = 1;
const WHEEL_DELTA_MODE_PAGE = 2;
const WHEEL_DELTA_LINE_HEIGHT = 16;
const ONEKEY_WATERMARK_ASSET =
  require('@onekeyhq/components/svg/illus/logo.svg') as
    | string
    | { default: string };
const ONEKEY_WATERMARK_URI =
  typeof ONEKEY_WATERMARK_ASSET === 'string'
    ? ONEKEY_WATERMARK_ASSET
    : ONEKEY_WATERMARK_ASSET.default;

interface IChartColors {
  axisText: string;
  background: string;
  grid: string;
  up: string;
  down: string;
}

interface ITradingViewNativeChartProps {
  candleIntervalSeconds: number;
  isSwitchingInterval: boolean;
  onVisiblePointRangeChange?: (
    range: ITradingViewNativeVisiblePointRange,
  ) => void;
  points: IMarketTokenKLineDataPoint[];
  testID?: string;
}

interface IChartViewportState {
  offset: number;
  zoomScale: number;
}

interface IPointerDragState {
  pointerId: number;
  startClientX: number;
  startOffset: number;
  zoomScale: number;
}

interface ICrosshairPosition {
  x: number;
  y: number;
}

interface IDrawKLineChartOptions {
  candleIntervalSeconds: number;
  canvas: HTMLCanvasElement;
  colors: IChartColors;
  crosshairPosition: ICrosshairPosition | null;
  panOffset: number;
  points: IMarketTokenKLineDataPoint[];
  watermarkImage: HTMLImageElement | null;
  watermarkOpacity: number;
  zoomScale: number;
}

interface IDrawChartLegendRowOptions {
  backgroundColor: string;
  context: CanvasRenderingContext2D;
  items: ITradingViewNativeLegendItem[];
  labelColor: string;
  maxX: number;
  top: number;
  valueColor: string;
}

function drawChartLegendRow({
  backgroundColor,
  context,
  items,
  labelColor,
  maxX,
  top,
  valueColor,
}: IDrawChartLegendRowOptions) {
  if (!items.length || maxX <= LEGEND_HORIZONTAL_PADDING) {
    return;
  }

  context.save();
  context.beginPath();
  const backgroundLeft = Math.max(
    LEGEND_HORIZONTAL_PADDING - LEGEND_BACKGROUND_HORIZONTAL_PADDING,
    CHART_HORIZONTAL_PADDING,
  );
  const backgroundTop = Math.max(top - LEGEND_BACKGROUND_VERTICAL_PADDING, 0);
  context.rect(
    backgroundLeft,
    backgroundTop,
    maxX - backgroundLeft,
    LEGEND_FONT_SIZE + LEGEND_BACKGROUND_VERTICAL_PADDING * 2,
  );
  context.clip();
  context.font = `${LEGEND_FONT_SIZE}px sans-serif`;
  context.textAlign = 'left';
  context.textBaseline = 'top';

  const contentWidth = items.reduce(
    (width, item, index) =>
      width +
      context.measureText(item.label).width +
      LEGEND_LABEL_VALUE_GAP +
      context.measureText(item.value).width +
      (index === items.length - 1 ? 0 : LEGEND_ITEM_GAP),
    0,
  );
  context.globalAlpha = LEGEND_BACKGROUND_OPACITY;
  context.fillStyle = backgroundColor;
  context.fillRect(
    backgroundLeft,
    backgroundTop,
    Math.min(
      contentWidth + LEGEND_BACKGROUND_HORIZONTAL_PADDING * 2,
      maxX - backgroundLeft,
    ),
    LEGEND_FONT_SIZE + LEGEND_BACKGROUND_VERTICAL_PADDING * 2,
  );
  context.globalAlpha = 1;

  let x = LEGEND_HORIZONTAL_PADDING;
  for (const item of items) {
    context.fillStyle = labelColor;
    context.fillText(item.label, x, top);
    x += context.measureText(item.label).width + LEGEND_LABEL_VALUE_GAP;

    context.fillStyle = valueColor;
    context.fillText(item.value, x, top);
    x += context.measureText(item.value).width + LEGEND_ITEM_GAP;
  }

  context.restore();
}

function getCanvasChartWidth(canvas: HTMLCanvasElement) {
  return getTradingViewNativeChartWidth(canvas.getBoundingClientRect().width);
}

function getWheelDeltaYInPixels(event: WheelEvent, canvas: HTMLCanvasElement) {
  if (event.deltaMode === WHEEL_DELTA_MODE_LINE) {
    return event.deltaY * WHEEL_DELTA_LINE_HEIGHT;
  }
  if (event.deltaMode === WHEEL_DELTA_MODE_PAGE) {
    return event.deltaY * canvas.clientHeight;
  }
  return event.deltaY;
}

function drawKLineChart({
  candleIntervalSeconds,
  canvas,
  colors,
  crosshairPosition,
  panOffset,
  points,
  watermarkImage,
  watermarkOpacity,
  zoomScale,
}: IDrawKLineChartOptions) {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  if (width <= 0 || height <= 0) {
    return;
  }

  const pixelRatio = Math.max(globalThis.devicePixelRatio || 1, 1);
  const pixelWidth = Math.round(width * pixelRatio);
  const pixelHeight = Math.round(height * pixelRatio);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.background;
  context.fillRect(0, 0, width, height);

  const watermarkLayout = getTradingViewNativeWatermarkLayout({
    height,
    width,
  });
  if (watermarkImage && watermarkLayout) {
    context.save();
    context.globalAlpha = watermarkOpacity;
    context.drawImage(
      watermarkImage,
      watermarkLayout.x,
      watermarkLayout.y,
      watermarkLayout.width,
      watermarkLayout.height,
    );
    context.restore();
  }

  if (!points.length) {
    return;
  }

  const chartWidth = getTradingViewNativeChartWidth(width);
  if (chartWidth <= 0) {
    return;
  }

  const clampedZoomScale = clampTradingViewNativeZoomScale(zoomScale);
  const clampedPanOffset = clampTradingViewNativePanOffset({
    chartWidth,
    offset: panOffset,
    pointCount: points.length,
    zoomScale: clampedZoomScale,
  });
  const visiblePointRange = getTradingViewNativeVisiblePointRange({
    chartWidth,
    offset: clampedPanOffset,
    pointCount: points.length,
    zoomScale: clampedZoomScale,
  });
  const layout = getTradingViewNativeChartLayout({
    candleIntervalSeconds,
    height,
    minimumTimeTickIndexSpacing:
      getTradingViewNativeTimeTickMinimumIndexSpacing(
        TRADING_VIEW_NATIVE_CANDLE_STEP * clampedZoomScale,
      ),
    points,
    visiblePointRange,
    width,
  });
  if (!layout) {
    return;
  }
  const {
    maxVolume,
    maxPrice,
    minPrice,
    priceAxisX,
    priceChartHeight,
    priceTicks,
    timeAxisY,
    timeTicks,
    volumeBottom,
    volumeHeight,
    volumeTop,
  } = layout;
  const getPointX = (index: number) =>
    getTradingViewNativeCandleX({
      index,
      offset: clampedPanOffset,
      pointCount: points.length,
      priceAxisX,
      zoomScale: clampedZoomScale,
    });
  const crosshairPointIndex = crosshairPosition
    ? getTradingViewNativePointIndexAtX({
        offset: clampedPanOffset,
        pointCount: points.length,
        priceAxisX,
        x: crosshairPosition.x,
        zoomScale: clampedZoomScale,
      })
    : null;
  const crosshairPoint =
    crosshairPointIndex === null ? null : points[crosshairPointIndex];
  const crosshairX =
    crosshairPointIndex === null ? null : getPointX(crosshairPointIndex);
  const crosshairY =
    crosshairPointIndex === null || !crosshairPosition
      ? null
      : Math.min(Math.max(crosshairPosition.y, 0), timeAxisY);
  const crosshairPrice =
    crosshairY === null
      ? null
      : getTradingViewNativePriceAtY({
          maxPrice,
          minPrice,
          priceChartHeight,
          y: crosshairY,
        });

  context.strokeStyle = colors.grid;
  context.lineWidth = 1;
  context.setLineDash([]);
  context.beginPath();
  context.moveTo(CHART_HORIZONTAL_PADDING, timeAxisY);
  context.lineTo(priceAxisX, timeAxisY);
  context.stroke();

  context.setLineDash([GRID_LINE_DASH_LENGTH, GRID_LINE_DASH_GAP]);
  context.beginPath();
  for (const tick of timeTicks) {
    const x = getPointX(tick.index);
    if (x >= CHART_HORIZONTAL_PADDING && x <= priceAxisX) {
      context.moveTo(x, 0);
      context.lineTo(x, timeAxisY);
    }
  }
  context.stroke();

  context.fillStyle = colors.axisText;
  context.font = '11px sans-serif';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  for (const { price, y } of priceTicks) {
    context.beginPath();
    context.moveTo(CHART_HORIZONTAL_PADDING, y);
    context.lineTo(priceAxisX + 4, y);
    context.stroke();
    context.fillText(
      formatTradingViewNativePriceTick(price),
      width - PRICE_AXIS_LABEL_RIGHT_PADDING,
      y,
    );
  }

  context.save();
  context.beginPath();
  context.rect(
    CHART_HORIZONTAL_PADDING,
    timeAxisY,
    chartWidth,
    TIME_AXIS_HEIGHT,
  );
  context.clip();
  context.textAlign = 'center';
  for (const tick of timeTicks) {
    context.fillText(
      tick.label,
      getPointX(tick.index),
      timeAxisY + TIME_AXIS_HEIGHT / 2,
    );
  }
  context.restore();

  const toY = (price: number) => getTradingViewNativePriceY(price, layout);
  const candleBodyWidth =
    TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH * clampedZoomScale;

  context.save();
  context.beginPath();
  context.rect(CHART_HORIZONTAL_PADDING, 0, chartWidth, timeAxisY);
  context.clip();

  for (
    let index = visiblePointRange.startIndex;
    index < visiblePointRange.endIndex;
    index += 1
  ) {
    const point = points[index];
    const color = isTradingViewNativePriceUp(point) ? colors.up : colors.down;
    const x = getPointX(index);
    const openY = toY(point.o);
    const highY = toY(point.h);
    const lowY = toY(point.l);
    const closeY = toY(point.c);

    context.fillStyle = color;
    context.fillRect(
      x - TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH / 2,
      highY,
      TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
      Math.max(lowY - highY, 1),
    );
    context.fillRect(
      x - candleBodyWidth / 2,
      Math.min(openY, closeY),
      candleBodyWidth,
      Math.max(Math.abs(closeY - openY), 1),
    );

    if (maxVolume > 0 && Number.isFinite(point.v) && point.v > 0) {
      const volumeBarHeight = Math.max((point.v / maxVolume) * volumeHeight, 1);
      context.globalAlpha = VOLUME_OPACITY;
      context.fillRect(
        x - candleBodyWidth / 2,
        volumeBottom - volumeBarHeight,
        candleBodyWidth,
        volumeBarHeight,
      );
      context.globalAlpha = 1;
    }
  }
  context.restore();

  const latestPoint = points[points.length - 1];
  if (crosshairX !== null && crosshairY !== null) {
    context.save();
    context.globalAlpha = CROSSHAIR_LINE_OPACITY;
    context.strokeStyle = colors.axisText;
    context.lineWidth = 1;
    context.setLineDash([CROSSHAIR_LINE_DASH_LENGTH, CROSSHAIR_LINE_DASH_GAP]);
    context.beginPath();
    context.moveTo(crosshairX, 0);
    context.lineTo(crosshairX, timeAxisY);
    context.moveTo(CHART_HORIZONTAL_PADDING, crosshairY);
    context.lineTo(priceAxisX, crosshairY);
    context.stroke();
    context.restore();
  }

  const legend = getTradingViewNativeChartLegend(crosshairPoint ?? latestPoint);
  const legendPointColor = legend.isUp ? colors.up : colors.down;
  drawChartLegendRow({
    backgroundColor: colors.background,
    context,
    items: legend.priceItems,
    labelColor: colors.axisText,
    maxX: priceAxisX,
    top: PRICE_LEGEND_TOP,
    valueColor: legendPointColor,
  });
  drawChartLegendRow({
    backgroundColor: colors.background,
    context,
    items: [legend.volumeItem],
    labelColor: colors.axisText,
    maxX: priceAxisX,
    top: volumeTop + VOLUME_LEGEND_TOP_PADDING,
    valueColor: legendPointColor,
  });

  const latestPointColor = isTradingViewNativePriceUp(latestPoint)
    ? colors.up
    : colors.down;

  const currentPriceLayout = getTradingViewNativeCurrentPriceLayout({
    labelHeight: CURRENT_PRICE_LABEL_HEIGHT,
    maxPrice,
    minPrice,
    price: latestPoint.c,
    priceChartHeight,
  });
  if (currentPriceLayout) {
    context.save();
    context.strokeStyle = latestPointColor;
    context.lineWidth = 1;
    context.setLineDash([
      CURRENT_PRICE_LINE_DASH_LENGTH,
      CURRENT_PRICE_LINE_DASH_GAP,
    ]);
    context.beginPath();
    context.moveTo(CHART_HORIZONTAL_PADDING, currentPriceLayout.lineY);
    context.lineTo(priceAxisX, currentPriceLayout.lineY);
    context.stroke();

    context.fillStyle = latestPointColor;
    context.fillRect(
      priceAxisX,
      currentPriceLayout.labelTop,
      width - priceAxisX,
      CURRENT_PRICE_LABEL_HEIGHT,
    );
    context.fillStyle = CURRENT_PRICE_LABEL_TEXT_COLOR;
    context.font = '11px sans-serif';
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillText(
      formatTradingViewNativePriceTick(latestPoint.c),
      width - PRICE_AXIS_LABEL_RIGHT_PADDING,
      currentPriceLayout.labelTop + CURRENT_PRICE_LABEL_HEIGHT / 2,
    );
    context.restore();
  }

  if (crosshairPoint && crosshairX !== null && crosshairY !== null) {
    context.save();
    context.setLineDash([]);
    context.fillStyle = CROSSHAIR_LABEL_BACKGROUND_COLOR;
    context.font = '11px sans-serif';
    context.textBaseline = 'middle';

    if (crosshairPrice !== null) {
      const priceLabelTop = Math.min(
        Math.max(crosshairY - CROSSHAIR_LABEL_HEIGHT / 2, 0),
        timeAxisY - CROSSHAIR_LABEL_HEIGHT,
      );
      context.fillRect(
        priceAxisX,
        priceLabelTop,
        width - priceAxisX,
        CROSSHAIR_LABEL_HEIGHT,
      );
      context.fillStyle = CROSSHAIR_LABEL_TEXT_COLOR;
      context.textAlign = 'right';
      context.fillText(
        formatTradingViewNativePriceTick(crosshairPrice),
        width - PRICE_AXIS_LABEL_RIGHT_PADDING,
        priceLabelTop + CROSSHAIR_LABEL_HEIGHT / 2,
      );
    }

    const timeLabel = formatTradingViewNativeCrosshairTime(
      crosshairPoint.t,
      candleIntervalSeconds,
    );
    const timeLabelWidth = Math.min(
      context.measureText(timeLabel).width +
        CROSSHAIR_LABEL_HORIZONTAL_PADDING * 2,
      priceAxisX,
    );
    const timeLabelLeft = Math.min(
      Math.max(crosshairX - timeLabelWidth / 2, CHART_HORIZONTAL_PADDING),
      priceAxisX - timeLabelWidth,
    );
    const timeLabelTop =
      timeAxisY + (TIME_AXIS_HEIGHT - CROSSHAIR_LABEL_HEIGHT) / 2;
    context.fillStyle = CROSSHAIR_LABEL_BACKGROUND_COLOR;
    context.fillRect(
      timeLabelLeft,
      timeLabelTop,
      timeLabelWidth,
      CROSSHAIR_LABEL_HEIGHT,
    );
    context.fillStyle = CROSSHAIR_LABEL_TEXT_COLOR;
    context.textAlign = 'center';
    context.fillText(
      timeLabel,
      timeLabelLeft + timeLabelWidth / 2,
      timeLabelTop + CROSSHAIR_LABEL_HEIGHT / 2,
    );
    context.restore();
  }
}

export const TradingViewNativeChart = memo(
  ({
    candleIntervalSeconds,
    isSwitchingInterval,
    onVisiblePointRangeChange,
    points,
    testID,
  }: ITradingViewNativeChartProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const crosshairPositionRef = useRef<ICrosshairPosition | null>(null);
    const pointerDragStateRef = useRef<IPointerDragState | null>(null);
    const [watermarkImage, setWatermarkImage] =
      useState<HTMLImageElement | null>(null);
    const [measuredChartWidth, setMeasuredChartWidth] = useState(0);
    const [viewportState, setViewportState] = useState<IChartViewportState>(
      () => ({
        offset: 0,
        zoomScale: TRADING_VIEW_NATIVE_DEFAULT_ZOOM_SCALE,
      }),
    );
    const panOffset = viewportState.offset;
    const zoomScale = viewportState.zoomScale;
    const pointCount = points.length;
    const previousLatestTimestampRef = useRef<number | undefined>(
      points[pointCount - 1]?.t,
    );
    const theme = useTheme();
    const themeName = useThemeName();
    const background = theme.bgApp.val;
    const grid = theme.borderSubdued.val;
    const axisText = theme.textSubdued.val;
    const watermarkOpacity =
      themeName === 'dark' ? WATERMARK_DARK_OPACITY : WATERMARK_LIGHT_OPACITY;

    useEffect(() => {
      const image = new Image();
      let isActive = true;
      image.onload = () => {
        if (isActive) {
          setWatermarkImage(image);
        }
      };
      image.src = ONEKEY_WATERMARK_URI;
      return () => {
        isActive = false;
        image.onload = null;
      };
    }, []);

    const renderChart = useCallback(
      (nextPanOffset: number, nextZoomScale: number) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }

        drawKLineChart({
          candleIntervalSeconds,
          canvas,
          colors: {
            axisText,
            background,
            grid,
            up: CHART_UP_COLOR,
            down: CHART_DOWN_COLOR,
          },
          crosshairPosition: crosshairPositionRef.current,
          panOffset: nextPanOffset,
          points,
          watermarkImage,
          watermarkOpacity,
          zoomScale: nextZoomScale,
        });
      },
      [
        axisText,
        background,
        candleIntervalSeconds,
        grid,
        points,
        watermarkImage,
        watermarkOpacity,
      ],
    );

    useLayoutEffect(() => {
      const dataUpdateMetadata = getTradingViewNativeDataUpdateMetadata({
        points,
        previousLatestTimestamp: previousLatestTimestampRef.current,
      });
      previousLatestTimestampRef.current = dataUpdateMetadata.latestTimestamp;

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const chartWidth = getCanvasChartWidth(canvas);
      const dragState = pointerDragStateRef.current;
      if (dragState) {
        dragState.startOffset = getTradingViewNativeViewportOffsetTransition({
          appendedPointCount: dataUpdateMetadata.appendedPointCount,
          chartWidth,
          currentOffset: dragState.startOffset,
          pointCount,
          zoomScale: dragState.zoomScale,
        }).nextOffset;
      }
      setViewportState((currentState) => {
        const { nextOffset } = getTradingViewNativeViewportOffsetTransition({
          appendedPointCount: dataUpdateMetadata.appendedPointCount,
          chartWidth,
          currentOffset: currentState.offset,
          pointCount,
          zoomScale: currentState.zoomScale,
        });
        return currentState.offset === nextOffset
          ? currentState
          : { ...currentState, offset: nextOffset };
      });
    }, [pointCount, points]);

    useLayoutEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return undefined;
      }

      const renderCurrentChart = () => {
        renderChart(panOffset, zoomScale);
        const nextChartWidth = getCanvasChartWidth(canvas);
        setMeasuredChartWidth((currentWidth) =>
          currentWidth === nextChartWidth ? currentWidth : nextChartWidth,
        );
      };
      renderCurrentChart();

      const resizeObserver = new ResizeObserver(renderCurrentChart);
      resizeObserver.observe(canvas);

      return () => {
        resizeObserver.disconnect();
      };
    }, [panOffset, renderChart, zoomScale]);

    useEffect(() => {
      if (measuredChartWidth <= 0 || pointCount <= 0) {
        return;
      }
      onVisiblePointRangeChange?.(
        getTradingViewNativeVisiblePointRange({
          chartWidth: measuredChartWidth,
          offset: panOffset,
          pointCount,
          zoomScale,
        }),
      );
    }, [
      measuredChartWidth,
      onVisiblePointRangeChange,
      panOffset,
      pointCount,
      zoomScale,
    ]);

    const handlePointerDown = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (event.button !== 0) {
          return;
        }

        crosshairPositionRef.current = null;
        renderChart(panOffset, zoomScale);

        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          return;
        }

        const chartWidth = getCanvasChartWidth(event.currentTarget);
        pointerDragStateRef.current = {
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startOffset: clampTradingViewNativePanOffset({
            chartWidth,
            offset: panOffset,
            pointCount,
            zoomScale,
          }),
          zoomScale,
        };
      },
      [panOffset, pointCount, renderChart, zoomScale],
    );

    const handlePointerMove = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const dragState = pointerDragStateRef.current;
        if (!dragState) {
          const canvasRect = event.currentTarget.getBoundingClientRect();
          crosshairPositionRef.current = {
            x: event.clientX - canvasRect.left,
            y: event.clientY - canvasRect.top,
          };
          renderChart(panOffset, zoomScale);
          return;
        }
        if (dragState.pointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        const chartWidth = getCanvasChartWidth(event.currentTarget);
        const nextOffset = clampTradingViewNativePanOffset({
          chartWidth,
          offset:
            dragState.startOffset + event.clientX - dragState.startClientX,
          pointCount,
          zoomScale: dragState.zoomScale,
        });
        renderChart(nextOffset, dragState.zoomScale);
        setViewportState((currentState) =>
          currentState.offset === nextOffset &&
          currentState.zoomScale === dragState.zoomScale
            ? currentState
            : {
                offset: nextOffset,
                zoomScale: dragState.zoomScale,
              },
        );
      },
      [panOffset, pointCount, renderChart, zoomScale],
    );

    const handlePointerLeave = useCallback(() => {
      if (pointerDragStateRef.current) {
        return;
      }
      crosshairPositionRef.current = null;
      renderChart(panOffset, zoomScale);
    }, [panOffset, renderChart, zoomScale]);

    const finishPointerDrag = useCallback(
      (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (pointerDragStateRef.current?.pointerId !== event.pointerId) {
          return;
        }

        pointerDragStateRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      },
      [],
    );

    const handleWheel = useCallback(
      (event: WheelEvent) => {
        event.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const canvasRect = canvas.getBoundingClientRect();
        const chartWidth = getCanvasChartWidth(canvas);
        const deltaY = getWheelDeltaYInPixels(event, canvas);
        const anchorX =
          event.clientX - canvasRect.left - CHART_HORIZONTAL_PADDING;
        setViewportState((currentState) => {
          const nextViewport = getTradingViewNativeZoomedViewport({
            anchorX,
            chartWidth,
            currentOffset: currentState.offset,
            currentZoomScale: currentState.zoomScale,
            nextZoomScale:
              currentState.zoomScale *
              Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY),
            pointCount,
          });
          if (
            currentState.offset === nextViewport.offset &&
            currentState.zoomScale === nextViewport.zoomScale
          ) {
            return currentState;
          }
          return nextViewport;
        });
      },
      [pointCount],
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return undefined;
      }

      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        canvas.removeEventListener('wheel', handleWheel);
      };
    }, [handleWheel]);

    return (
      <Stack
        flex={1}
        minHeight={0}
        opacity={isSwitchingInterval ? SWITCHING_INTERVAL_OPACITY : 1}
      >
        <canvas
          ref={canvasRef}
          data-testid={testID}
          onLostPointerCapture={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          style={{
            cursor: 'crosshair',
            display: 'block',
            touchAction: 'pan-y',
            userSelect: 'none',
            width: '100%',
            height: '100%',
          }}
        />
      </Stack>
    );
  },
);

TradingViewNativeChart.displayName = 'TradingViewNativeChart';
