import {
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE as AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_LEFT_PADDING as PRICE_AXIS_LABEL_LEFT_PADDING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_TEXT_BASELINE_OFFSET as PRICE_AXIS_TEXT_BASELINE_OFFSET,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_HEIGHT as PRICE_LABEL_HEIGHT,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_TEXT_COLOR as PRICE_LABEL_TEXT_COLOR,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LINE_DASH_GAP as REFERENCE_LINE_DASH_GAP,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LINE_DASH_LENGTH as REFERENCE_LINE_DASH_LENGTH,
  TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_HORIZONTAL_PADDING as REFERENCE_LINE_LABEL_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_SEPARATOR_WIDTH as REFERENCE_LINE_LABEL_SEPARATOR_WIDTH,
} from '../chartConstants';

import {
  formatTradingViewNativePriceTick,
  getTradingViewNativeCurrentPriceLayout,
} from './chartLayout';

import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartSceneFont,
  ITradingViewNativeChartScenePaintStyle,
} from './chartScene';
import type {
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativePriceScaleMode,
} from '../types';

interface ITradingViewNativeChartComponentCommandLayers {
  priceLabelCommands: ITradingViewNativeChartSceneCommand[];
  textLabelCommands: ITradingViewNativeChartSceneCommand[];
}

function getReferenceLinePaintId(id: string, part: 'label' | 'line' | 'text') {
  'worklet';

  return `chart.component.referenceLine.${id}.${part}`;
}

export function appendTradingViewNativeChartComponentCommands({
  commands,
  components,
  customPaintStyles,
  maxPrice,
  measureTextWidth,
  minPrice,
  priceAxisX,
  priceChartHeight,
  priceScaleMode,
  showYAxis,
  width,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  components: readonly ITradingViewNativeChartLeafComponent[];
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  maxPrice: number;
  measureTextWidth: (
    text: string,
    font: ITradingViewNativeChartSceneFont,
  ) => number;
  minPrice: number;
  priceAxisX: number;
  priceChartHeight: number;
  priceScaleMode: ITradingViewNativePriceScaleMode;
  showYAxis: boolean;
  width: number;
}): ITradingViewNativeChartComponentCommandLayers {
  'worklet';

  const priceLabelCommands: ITradingViewNativeChartSceneCommand[] = [];
  const textLabelCommands: ITradingViewNativeChartSceneCommand[] = [];
  for (const component of components) {
    const { anchor, color, style, title } = component.props;
    const priceLayout = getTradingViewNativeCurrentPriceLayout({
      labelHeight: PRICE_LABEL_HEIGHT,
      maxPrice,
      minPrice,
      price: anchor.price,
      priceChartHeight,
      priceScaleMode,
    });
    if (priceLayout) {
      const linePaintId = getReferenceLinePaintId(component.id, 'line');
      const labelPaintId = getReferenceLinePaintId(component.id, 'label');
      const textPaintId = getReferenceLinePaintId(component.id, 'text');
      customPaintStyles[linePaintId] = {
        color,
        dash:
          style === 'dashed'
            ? [REFERENCE_LINE_DASH_LENGTH, REFERENCE_LINE_DASH_GAP]
            : undefined,
        opacity: 1,
      };
      customPaintStyles[labelPaintId] = { color, opacity: 1 };
      customPaintStyles[textPaintId] = {
        color: PRICE_LABEL_TEXT_COLOR,
        opacity: 1,
      };

      commands.push({
        customPaintId: linePaintId,
        kind: 'line',
        paint: 'gridLine',
        x1: CHART_HORIZONTAL_PADDING,
        x2: priceAxisX,
        y1: priceLayout.lineY,
        y2: priceLayout.lineY,
      });

      if (title.length > 0) {
        const labelSeparatorWidth = showYAxis
          ? REFERENCE_LINE_LABEL_SEPARATOR_WIDTH
          : 0;
        const availableTitleWidth = Math.max(
          priceAxisX - CHART_HORIZONTAL_PADDING - labelSeparatorWidth,
          0,
        );
        const titleWidth = Math.min(
          measureTextWidth(title, 'priceAxis') +
            REFERENCE_LINE_LABEL_HORIZONTAL_PADDING * 2,
          availableTitleWidth,
        );
        if (titleWidth > 0) {
          const titleX = priceAxisX - labelSeparatorWidth - titleWidth;
          const titleRect = {
            height: PRICE_LABEL_HEIGHT,
            width: titleWidth,
            x: titleX,
            y: priceLayout.labelTop,
          };
          textLabelCommands.push(
            { kind: 'clip', rect: titleRect },
            {
              ...titleRect,
              customPaintId: labelPaintId,
              kind: 'rect',
              paint: 'background',
            },
            {
              customPaintId: textPaintId,
              font: 'priceAxis',
              kind: 'text',
              paint: 'currentPriceLabelText',
              text: title,
              x: titleX + REFERENCE_LINE_LABEL_HORIZONTAL_PADDING,
              y:
                priceLayout.labelTop +
                PRICE_LABEL_HEIGHT / 2 +
                AXIS_FONT_SIZE / 2 +
                PRICE_AXIS_TEXT_BASELINE_OFFSET,
            },
            { kind: 'restore' },
          );
          if (showYAxis) {
            textLabelCommands.push({
              height: PRICE_LABEL_HEIGHT,
              kind: 'rect',
              paint: 'background',
              width: REFERENCE_LINE_LABEL_SEPARATOR_WIDTH,
              x: priceAxisX - REFERENCE_LINE_LABEL_SEPARATOR_WIDTH,
              y: priceLayout.labelTop,
            });
          }
        }
      }

      if (showYAxis) {
        priceLabelCommands.push(
          {
            customPaintId: labelPaintId,
            height: PRICE_LABEL_HEIGHT,
            kind: 'rect',
            paint: 'background',
            width: width - priceAxisX,
            x: priceAxisX,
            y: priceLayout.labelTop,
          },
          {
            customPaintId: textPaintId,
            font: 'priceAxis',
            kind: 'text',
            paint: 'currentPriceLabelText',
            text: formatTradingViewNativePriceTick(anchor.price),
            x: priceAxisX + PRICE_AXIS_LABEL_LEFT_PADDING,
            y:
              priceLayout.labelTop +
              PRICE_LABEL_HEIGHT / 2 +
              AXIS_FONT_SIZE / 2 +
              PRICE_AXIS_TEXT_BASELINE_OFFSET,
          },
        );
      }
    }
  }
  return { priceLabelCommands, textLabelCommands };
}
