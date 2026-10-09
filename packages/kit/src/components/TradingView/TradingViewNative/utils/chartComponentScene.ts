import {
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE as AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING as CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_FLOATING_PRICE_LABEL_HORIZONTAL_PADDING as FLOATING_PRICE_LABEL_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_PREVIOUS_CLOSE_REFERENCE_LINE_ID as PREVIOUS_CLOSE_REFERENCE_LINE_ID,
  TRADING_VIEW_NATIVE_PRICE_AXIS_TEXT_BASELINE_OFFSET as PRICE_AXIS_TEXT_BASELINE_OFFSET,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_HEIGHT as PRICE_LABEL_HEIGHT,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_TEXT_COLOR as PRICE_LABEL_TEXT_COLOR,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LINE_DASH_GAP as REFERENCE_LINE_DASH_GAP,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LINE_DASH_LENGTH as REFERENCE_LINE_DASH_LENGTH,
  TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_HORIZONTAL_PADDING as REFERENCE_LINE_LABEL_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_REFERENCE_LINE_LABEL_SEPARATOR_WIDTH as REFERENCE_LINE_LABEL_SEPARATOR_WIDTH,
  TRADING_VIEW_NATIVE_TRADING_LINE_LABEL_FONT_SIZE as TRADING_LINE_LABEL_FONT_SIZE,
  TRADING_VIEW_NATIVE_TRADING_LINE_LABEL_HEIGHT as TRADING_LINE_LABEL_HEIGHT,
  TRADING_VIEW_NATIVE_TRADING_LINE_LABEL_PADDING as TRADING_LINE_LABEL_PADDING,
} from '../chartConstants';

import {
  formatTradingViewNativePriceTick,
  getTradingViewNativeCurrentPriceLayout,
} from './chartLayout';

import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartSceneFont,
  ITradingViewNativeChartScenePaintStyle,
  ITradingViewNativeChartSceneRect,
} from './chartScene';
import type {
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativePriceScaleMode,
  ITradingViewNativeReferenceLineComponent,
} from '../types';

interface ITradingViewNativeChartComponentCommandLayers {
  currentPriceLabelTop?: number;
  priceLabelCommands: ITradingViewNativeChartSceneCommand[];
  textLabelCommands: ITradingViewNativeChartSceneCommand[];
  hitRegions: ITradingViewNativeReferenceLineHitRegion[];
}

export interface ITradingViewNativeReferenceLineHitRegion {
  id: string;
  action: 'cancel' | 'drag';
  price: number;
  rect: ITradingViewNativeChartSceneRect;
}

function getReferenceLinePaintId(id: string, part: 'label' | 'line' | 'text') {
  'worklet';

  return `chart.component.referenceLine.${id}.${part}`;
}

function appendTradingLineLabelCommands({
  component,
  commands,
  customPaintStyles,
  hitRegions,
  lineY,
  maxX,
  measureTextWidth,
  priceChartHeight,
}: {
  component: ITradingViewNativeReferenceLineComponent;
  commands: ITradingViewNativeChartSceneCommand[];
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  hitRegions: ITradingViewNativeReferenceLineHitRegion[];
  lineY: number;
  maxX: number;
  measureTextWidth: (
    text: string,
    font: ITradingViewNativeChartSceneFont,
  ) => number;
  priceChartHeight: number;
}) {
  'worklet';

  const {
    anchor,
    color,
    title,
    label,
    interactive,
    cancelable,
    draggable,
    pending,
  } = component.props;
  if (!label) return;
  const opacity = pending ? 0.5 : 1;
  const paintId = `${getReferenceLinePaintId(component.id, 'label')}.trading`;
  const bodyPaintId = `${paintId}.body`;
  const bodyTextPaintId = `${paintId}.bodyText`;
  const quantityPaintId = `${paintId}.quantity`;
  const quantityTextPaintId = `${paintId}.quantityText`;
  const borderPaintId = `${paintId}.border`;
  customPaintStyles[bodyPaintId] = { color: label.backgroundColor, opacity };
  customPaintStyles[bodyTextPaintId] = { color: label.color, opacity };
  customPaintStyles[borderPaintId] = { color, opacity, drawStyle: 'stroke' };
  if (label.quantity) {
    customPaintStyles[quantityPaintId] = {
      color: label.quantity.backgroundColor,
      opacity,
    };
    customPaintStyles[quantityTextPaintId] = {
      color: label.quantity.color,
      opacity,
    };
  }

  const cancelWidth = interactive && cancelable ? TRADING_LINE_LABEL_HEIGHT : 0;
  const preferredTitleWidth =
    measureTextWidth(title, 'tradingLineLabel') +
    TRADING_LINE_LABEL_PADDING * 2;
  const preferredQuantityWidth = label.quantity
    ? measureTextWidth(label.quantity.text, 'tradingLineLabel') +
      TRADING_LINE_LABEL_PADDING * 2
    : 0;
  const left = Math.max(
    CHART_HORIZONTAL_PADDING,
    Math.min(
      CHART_HORIZONTAL_PADDING + label.offset,
      maxX - preferredTitleWidth - preferredQuantityWidth - cancelWidth,
    ),
  );
  const availableWidth = Math.max(maxX - left, 0);
  if (availableWidth <= cancelWidth + TRADING_LINE_LABEL_PADDING * 2) return;
  const quantityWidth = Math.min(
    preferredQuantityWidth,
    Math.max(availableWidth - cancelWidth - TRADING_LINE_LABEL_PADDING * 2, 0),
  );
  const titleWidth = Math.min(
    preferredTitleWidth,
    availableWidth - quantityWidth - cancelWidth,
  );
  const top = Math.max(
    CHART_TOP_PADDING,
    Math.min(
      lineY - TRADING_LINE_LABEL_HEIGHT / 2,
      CHART_TOP_PADDING + priceChartHeight - TRADING_LINE_LABEL_HEIGHT,
    ),
  );
  const labelRect = {
    x: left,
    y: top,
    width: titleWidth + quantityWidth + cancelWidth,
    height: TRADING_LINE_LABEL_HEIGHT,
  };
  const textY =
    top +
    TRADING_LINE_LABEL_HEIGHT / 2 +
    TRADING_LINE_LABEL_FONT_SIZE / 2 +
    PRICE_AXIS_TEXT_BASELINE_OFFSET;
  commands.push(
    {
      ...labelRect,
      kind: 'rect',
      paint: 'background',
      customPaintId: bodyPaintId,
    },
    {
      kind: 'clip',
      rect: { ...labelRect, width: titleWidth },
    },
    {
      kind: 'text',
      paint: 'axisText',
      customPaintId: bodyTextPaintId,
      font: 'tradingLineLabel',
      text: title,
      x: left + TRADING_LINE_LABEL_PADDING,
      y: textY,
    },
    { kind: 'restore' },
  );
  if (label.quantity && quantityWidth > 0) {
    const quantityRect = {
      ...labelRect,
      x: left + titleWidth,
      width: quantityWidth,
    };
    commands.push(
      { kind: 'clip', rect: quantityRect },
      {
        ...quantityRect,
        kind: 'rect',
        paint: 'background',
        customPaintId: quantityPaintId,
      },
      {
        kind: 'text',
        paint: 'axisText',
        customPaintId: quantityTextPaintId,
        font: 'tradingLineLabel',
        text: label.quantity.text,
        x: quantityRect.x + TRADING_LINE_LABEL_PADDING,
        y: textY,
      },
      { kind: 'restore' },
      {
        kind: 'line',
        paint: 'gridLine',
        customPaintId: borderPaintId,
        x1: quantityRect.x + 0.5,
        x2: quantityRect.x + 0.5,
        y1: top,
        y2: top + TRADING_LINE_LABEL_HEIGHT,
      },
    );
  }
  if (interactive && draggable && !pending) {
    hitRegions.push({
      id: component.id,
      action: 'drag',
      price: anchor.price,
      rect: { ...labelRect, width: titleWidth + quantityWidth },
    });
  }
  if (cancelWidth > 0) {
    const cancelRect = {
      ...labelRect,
      x: left + titleWidth + quantityWidth,
      width: cancelWidth,
    };
    const centerX = cancelRect.x + cancelWidth / 2;
    const centerY = top + TRADING_LINE_LABEL_HEIGHT / 2;
    commands.push(
      {
        kind: 'line',
        paint: 'gridLine',
        customPaintId: borderPaintId,
        x1: cancelRect.x + 0.5,
        x2: cancelRect.x + 0.5,
        y1: top,
        y2: top + TRADING_LINE_LABEL_HEIGHT,
      },
      {
        kind: 'line',
        paint: 'gridLine',
        customPaintId: bodyTextPaintId,
        x1: centerX - 3,
        x2: centerX + 3,
        y1: centerY - 3,
        y2: centerY + 3,
      },
      {
        kind: 'line',
        paint: 'gridLine',
        customPaintId: bodyTextPaintId,
        x1: centerX - 3,
        x2: centerX + 3,
        y1: centerY + 3,
        y2: centerY - 3,
      },
    );
    if (!pending) {
      hitRegions.push({
        id: component.id,
        action: 'cancel',
        price: anchor.price,
        rect: cancelRect,
      });
    }
  }
  commands.push({
    kind: 'rect',
    paint: 'gridLine',
    customPaintId: borderPaintId,
    x: left + 0.5,
    y: top + 0.5,
    width: labelRect.width - 1,
    height: labelRect.height - 1,
  });
}

export function appendTradingViewNativeChartComponentCommands({
  commands,
  components,
  currentPriceLabel,
  customPaintStyles,
  maxPrice,
  measureTextWidth,
  minPrice,
  priceAxisX,
  priceChartHeight,
  priceDecimalPlaces,
  priceScaleMode,
  showYAxis,
  width,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  components: readonly ITradingViewNativeChartLeafComponent[];
  currentPriceLabel?: { price: number; top: number };
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  maxPrice: number;
  measureTextWidth: (
    text: string,
    font: ITradingViewNativeChartSceneFont,
  ) => number;
  minPrice: number;
  priceAxisX: number;
  priceChartHeight: number;
  priceDecimalPlaces?: number;
  priceScaleMode: ITradingViewNativePriceScaleMode;
  showYAxis: boolean;
  width: number;
}): ITradingViewNativeChartComponentCommandLayers {
  'worklet';

  const priceLabelCommands: ITradingViewNativeChartSceneCommand[] = [];
  const textLabelCommands: ITradingViewNativeChartSceneCommand[] = [];
  const hitRegions: ITradingViewNativeReferenceLineHitRegion[] = [];
  let currentPriceLabelTop = currentPriceLabel?.top;
  components.forEach((component) => {
    if (component.type !== 'referenceLine') {
      return;
    }
    const {
      anchor,
      color,
      style,
      title,
      interactive,
      cancelable,
      draggable,
      pending,
      label,
    } = component.props;
    const canCancel = interactive && cancelable;
    const canDrag = interactive && draggable && !pending;
    const priceLayout = getTradingViewNativeCurrentPriceLayout({
      labelHeight: PRICE_LABEL_HEIGHT,
      maxPrice,
      minPrice,
      price: anchor.price,
      priceChartHeight,
      priceScaleMode,
    });
    if (priceLayout) {
      let labelTop = priceLayout.labelTop;
      if (
        component.id === PREVIOUS_CLOSE_REFERENCE_LINE_ID &&
        currentPriceLabel !== undefined &&
        priceLayout.labelTop < currentPriceLabel.top + PRICE_LABEL_HEIGHT &&
        priceLayout.labelTop + PRICE_LABEL_HEIGHT > currentPriceLabel.top
      ) {
        // Keep the pair inside the price pane without reversing the price order.
        const previousCloseAbove = anchor.price >= currentPriceLabel.price;
        const labelSpacing = Math.min(
          PRICE_LABEL_HEIGHT,
          Math.max(priceChartHeight - PRICE_LABEL_HEIGHT, 0),
        );
        const groupTop = Math.min(
          Math.max(
            currentPriceLabel.top - (previousCloseAbove ? labelSpacing : 0),
            CHART_TOP_PADDING,
          ),
          Math.max(
            CHART_TOP_PADDING +
              priceChartHeight -
              PRICE_LABEL_HEIGHT -
              labelSpacing,
            CHART_TOP_PADDING,
          ),
        );
        labelTop = groupTop + (previousCloseAbove ? 0 : labelSpacing);
        currentPriceLabelTop =
          groupTop + (previousCloseAbove ? labelSpacing : 0);
      }
      const priceLabel = formatTradingViewNativePriceTick(
        anchor.price,
        4,
        priceDecimalPlaces,
      );
      const priceLabelWidth =
        measureTextWidth(priceLabel, 'priceAxis') +
        FLOATING_PRICE_LABEL_HORIZONTAL_PADDING * 2;
      const priceLabelLeft = showYAxis
        ? Math.min(priceAxisX, width - priceLabelWidth)
        : priceAxisX;
      const linePaintId = getReferenceLinePaintId(component.id, 'line');
      const labelPaintId = getReferenceLinePaintId(component.id, 'label');
      const textPaintId = getReferenceLinePaintId(component.id, 'text');
      customPaintStyles[linePaintId] = {
        color,
        dash:
          style === 'dashed'
            ? [
                label ? 6 : REFERENCE_LINE_DASH_LENGTH,
                label ? 6 : REFERENCE_LINE_DASH_GAP,
              ]
            : undefined,
        opacity: 1,
      };
      customPaintStyles[labelPaintId] = { color, opacity: pending ? 0.5 : 1 };
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

      if (canDrag) {
        hitRegions.push({
          id: component.id,
          action: 'drag',
          price: anchor.price,
          rect: {
            x: CHART_HORIZONTAL_PADDING,
            y: priceLayout.lineY - 4,
            width: priceAxisX - CHART_HORIZONTAL_PADDING,
            height: 8,
          },
        });
      }
      const cancelButtonWidth = canCancel ? PRICE_LABEL_HEIGHT : 0;

      if (label) {
        appendTradingLineLabelCommands({
          component,
          commands: textLabelCommands,
          customPaintStyles,
          hitRegions,
          lineY: priceLayout.lineY,
          maxX: priceLabelLeft - REFERENCE_LINE_LABEL_SEPARATOR_WIDTH,
          measureTextWidth,
          priceChartHeight,
        });
      }

      if (!label && title.length > 0) {
        const labelSeparatorWidth = showYAxis
          ? REFERENCE_LINE_LABEL_SEPARATOR_WIDTH
          : 0;
        const availableTitleWidth = Math.max(
          priceLabelLeft -
            CHART_HORIZONTAL_PADDING -
            labelSeparatorWidth -
            cancelButtonWidth,
          0,
        );
        const titleWidth = Math.min(
          measureTextWidth(title, 'referenceLineLabel') +
            REFERENCE_LINE_LABEL_HORIZONTAL_PADDING * 2,
          availableTitleWidth,
        );
        if (titleWidth > 0) {
          const titleX =
            priceLabelLeft -
            labelSeparatorWidth -
            cancelButtonWidth -
            titleWidth;
          const titleRect = {
            height: PRICE_LABEL_HEIGHT,
            width: titleWidth,
            x: titleX,
            y: labelTop,
          };
          if (canDrag) {
            hitRegions.push({
              id: component.id,
              action: 'drag',
              price: anchor.price,
              rect: titleRect,
            });
          }
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
              font: 'referenceLineLabel',
              kind: 'text',
              paint: 'currentPriceLabelText',
              text: title,
              x: titleX + REFERENCE_LINE_LABEL_HORIZONTAL_PADDING,
              y:
                labelTop +
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
              x: priceLabelLeft - REFERENCE_LINE_LABEL_SEPARATOR_WIDTH,
              y: labelTop,
            });
          }
        }
      }

      if (
        !label &&
        canCancel &&
        priceLabelLeft - cancelButtonWidth >= CHART_HORIZONTAL_PADDING
      ) {
        const rect = {
          x: priceLabelLeft - cancelButtonWidth,
          y: labelTop,
          width: cancelButtonWidth,
          height: PRICE_LABEL_HEIGHT,
        };
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        textLabelCommands.push(
          {
            ...rect,
            kind: 'rect',
            customPaintId: labelPaintId,
            paint: 'background',
          },
          {
            kind: 'line',
            customPaintId: textPaintId,
            paint: 'gridLine',
            x1: centerX - 3,
            y1: centerY - 3,
            x2: centerX + 3,
            y2: centerY + 3,
          },
          {
            kind: 'line',
            customPaintId: textPaintId,
            paint: 'gridLine',
            x1: centerX - 3,
            y1: centerY + 3,
            x2: centerX + 3,
            y2: centerY - 3,
          },
        );
        if (!pending)
          hitRegions.push({
            id: component.id,
            action: 'cancel',
            price: anchor.price,
            rect,
          });
      }

      if (showYAxis) {
        priceLabelCommands.push(
          {
            customPaintId: labelPaintId,
            height: PRICE_LABEL_HEIGHT,
            kind: 'rect',
            paint: 'background',
            width: priceLabelWidth,
            x: priceLabelLeft,
            y: labelTop,
          },
          {
            customPaintId: textPaintId,
            font: 'priceAxis',
            kind: 'text',
            paint: 'currentPriceLabelText',
            text: priceLabel,
            x: priceLabelLeft + FLOATING_PRICE_LABEL_HORIZONTAL_PADDING,
            y:
              labelTop +
              PRICE_LABEL_HEIGHT / 2 +
              AXIS_FONT_SIZE / 2 +
              PRICE_AXIS_TEXT_BASELINE_OFFSET,
          },
        );
      }
    }
  });
  return {
    currentPriceLabelTop,
    priceLabelCommands,
    textLabelCommands,
    hitRegions,
  };
}
