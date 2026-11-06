import {
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE as AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE as LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_ORDER_LINE_LABEL_FONT_SIZE as ORDER_LINE_LABEL_FONT_SIZE,
  TRADING_VIEW_NATIVE_PRICE_AXIS_FONT_FAMILY as PRICE_AXIS_FONT_FAMILY,
  TRADING_VIEW_NATIVE_TRADING_LINE_LABEL_FONT_SIZE as TRADING_LINE_LABEL_FONT_SIZE,
} from '../chartConstants';
import {
  type ITradingViewNativeChartSceneColors,
  type ITradingViewNativeChartSceneCommand,
  type ITradingViewNativeChartSceneFont,
  type ITradingViewNativeChartScenePaintStyle,
  getTradingViewNativeChartScenePaintStyles,
} from '../utils/chartScene';

interface IDrawTradingViewNativeCanvasSceneOptions {
  colors: ITradingViewNativeChartSceneColors;
  commands: readonly ITradingViewNativeChartSceneCommand[];
  context: CanvasRenderingContext2D;
  customPaintStyles: Readonly<
    Record<string, ITradingViewNativeChartScenePaintStyle>
  >;
  priceAxisFontSize?: number;
  timeAxisFontSize?: number;
  timeAxisBorderWidth?: number;
  watermarkImage: HTMLImageElement | null;
}

type ITradingViewNativeDrawableChartSceneCommand = Extract<
  ITradingViewNativeChartSceneCommand,
  { paint: unknown }
>;

export function getTradingViewNativeCanvasFont(
  font: ITradingViewNativeChartSceneFont,
  priceAxisFontSize = AXIS_FONT_SIZE,
  timeAxisFontSize = AXIS_FONT_SIZE,
) {
  if (font === 'orderLineLabel') {
    return `${ORDER_LINE_LABEL_FONT_SIZE}px sans-serif`;
  }
  if (font === 'tradingLineLabel') {
    return `600 ${TRADING_LINE_LABEL_FONT_SIZE}px sans-serif`;
  }
  if (font === 'priceAxis' || font === 'referenceLineLabel') {
    return `${priceAxisFontSize}px ${PRICE_AXIS_FONT_FAMILY}`;
  }
  return `${font === 'axis' ? timeAxisFontSize : LEGEND_FONT_SIZE}px sans-serif`;
}

function getCanvasPaintStyle(
  command: ITradingViewNativeDrawableChartSceneCommand,
  customPaintStyles: Readonly<
    Record<string, ITradingViewNativeChartScenePaintStyle>
  >,
  paintStyles: ReturnType<typeof getTradingViewNativeChartScenePaintStyles>,
) {
  return (
    (command.customPaintId
      ? customPaintStyles[command.customPaintId]
      : undefined) ?? paintStyles[command.paint]
  );
}

export function drawTradingViewNativeCanvasScene({
  colors,
  commands,
  context,
  customPaintStyles,
  priceAxisFontSize,
  timeAxisFontSize,
  timeAxisBorderWidth,
  watermarkImage,
}: IDrawTradingViewNativeCanvasSceneOptions) {
  const paintStyles = getTradingViewNativeChartScenePaintStyles(colors, {
    timeAxisBorderWidth,
  });
  for (const command of commands) {
    switch (command.kind) {
      case 'circle': {
        const paint = getCanvasPaintStyle(
          command,
          customPaintStyles,
          paintStyles,
        );
        context.save();
        context.globalAlpha = paint.opacity;
        context.fillStyle = paint.color;
        context.beginPath();
        context.arc(command.cx, command.cy, command.radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
        break;
      }
      case 'clip':
        context.save();
        context.beginPath();
        context.rect(
          command.rect.x,
          command.rect.y,
          command.rect.width,
          command.rect.height,
        );
        context.clip();
        break;
      case 'line': {
        const paint = getCanvasPaintStyle(
          command,
          customPaintStyles,
          paintStyles,
        );
        context.save();
        context.globalAlpha = paint.opacity;
        context.strokeStyle = paint.color;
        context.lineWidth = paint.strokeWidth ?? 1;
        context.lineCap = paint.strokeCap ?? 'butt';
        context.lineJoin = paint.strokeJoin ?? 'miter';
        context.setLineDash(paint.dash ?? []);
        context.beginPath();
        context.moveTo(command.x1, command.y1);
        context.lineTo(command.x2, command.y2);
        context.stroke();
        context.restore();
        break;
      }
      case 'linearGradientRect': {
        const gradient = context.createLinearGradient(
          command.rect.x,
          command.rect.y,
          command.rect.x,
          command.rect.y + command.rect.height,
        );
        gradient.addColorStop(0, command.colors[0]);
        gradient.addColorStop(1, command.colors[1]);
        context.save();
        context.fillStyle = gradient;
        context.fillRect(
          command.rect.x,
          command.rect.y,
          command.rect.width,
          command.rect.height,
        );
        context.restore();
        break;
      }
      case 'polygon': {
        const firstPoint = command.points[0];
        if (!firstPoint) {
          break;
        }
        const paint = getCanvasPaintStyle(
          command,
          customPaintStyles,
          paintStyles,
        );
        context.save();
        context.globalAlpha = paint.opacity;
        context.fillStyle = paint.color;
        context.beginPath();
        context.moveTo(firstPoint.x, firstPoint.y);
        for (let index = 1; index < command.points.length; index += 1) {
          const point = command.points[index];
          context.lineTo(point.x, point.y);
        }
        context.closePath();
        context.fill();
        context.restore();
        break;
      }
      case 'polyline': {
        const firstPoint = command.points[0];
        if (!firstPoint) {
          break;
        }
        const paint = getCanvasPaintStyle(
          command,
          customPaintStyles,
          paintStyles,
        );
        context.save();
        context.globalAlpha = paint.opacity;
        context.strokeStyle = paint.color;
        context.lineWidth = paint.strokeWidth ?? 1;
        context.lineCap = paint.strokeCap ?? 'butt';
        context.lineJoin = paint.strokeJoin ?? 'miter';
        context.setLineDash(paint.dash ?? []);
        context.beginPath();
        context.moveTo(firstPoint.x, firstPoint.y);
        for (let index = 1; index < command.points.length; index += 1) {
          const point = command.points[index];
          context.lineTo(point.x, point.y);
        }
        context.stroke();
        context.restore();
        break;
      }
      case 'rect':
      case 'roundRect': {
        const paint = getCanvasPaintStyle(
          command,
          customPaintStyles,
          paintStyles,
        );
        context.save();
        context.globalAlpha = paint.opacity;
        if (command.kind === 'roundRect') {
          context.beginPath();
          context.roundRect(
            command.x,
            command.y,
            command.width,
            command.height,
            command.radius,
          );
        }
        if (paint.drawStyle === 'stroke') {
          context.strokeStyle = paint.color;
          context.lineWidth = paint.strokeWidth ?? 1;
          if (command.kind === 'roundRect') context.stroke();
          else
            context.strokeRect(
              command.x,
              command.y,
              command.width,
              command.height,
            );
        } else {
          context.fillStyle = paint.color;
          if (command.kind === 'roundRect') context.fill();
          else
            context.fillRect(
              command.x,
              command.y,
              command.width,
              command.height,
            );
        }
        context.restore();
        break;
      }
      case 'restore':
        context.restore();
        break;
      case 'text':
      case 'tradeMarkLabel': {
        const paint = getCanvasPaintStyle(
          command,
          customPaintStyles,
          paintStyles,
        );
        context.save();
        context.globalAlpha = paint.opacity;
        context.fillStyle = paint.color;
        context.textAlign = 'left';
        context.textBaseline = 'alphabetic';
        if (command.kind === 'tradeMarkLabel') {
          const fontSize = LEGEND_FONT_SIZE * (command.scale ?? 1);
          context.font = `${fontSize}px sans-serif`;
          context.fillText(
            command.label,
            command.cx - context.measureText(command.label).width / 2,
            command.cy + fontSize * 0.35,
          );
        } else {
          context.font = getTradingViewNativeCanvasFont(
            command.font,
            priceAxisFontSize,
            timeAxisFontSize,
          );
          const bounds = command.centerInk
            ? context.measureText(command.text)
            : undefined;
          context.fillText(
            command.text,
            command.x +
              (bounds
                ? (bounds.actualBoundingBoxLeft -
                    bounds.actualBoundingBoxRight) /
                  2
                : 0),
            command.y +
              (bounds
                ? (bounds.actualBoundingBoxAscent -
                    bounds.actualBoundingBoxDescent) /
                  2
                : 0),
          );
        }
        context.restore();
        break;
      }
      case 'watermark':
        if (watermarkImage) {
          context.save();
          context.globalAlpha = command.opacity;
          context.drawImage(
            watermarkImage,
            command.rect.x,
            command.rect.y,
            command.rect.width,
            command.rect.height,
          );
          context.restore();
        }
        break;
      default:
        command satisfies never;
    }
  }
}
