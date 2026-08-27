import {
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE as AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE as LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_PRICE_AXIS_FONT_FAMILY as PRICE_AXIS_FONT_FAMILY,
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
  watermarkImage: HTMLImageElement | null;
}

type ITradingViewNativeDrawableChartSceneCommand = Extract<
  ITradingViewNativeChartSceneCommand,
  { paint: unknown }
>;

export function getTradingViewNativeCanvasFont(
  font: ITradingViewNativeChartSceneFont,
) {
  if (font === 'priceAxis') {
    return `${AXIS_FONT_SIZE}px "${PRICE_AXIS_FONT_FAMILY}", monospace`;
  }
  return `${font === 'axis' ? AXIS_FONT_SIZE : LEGEND_FONT_SIZE}px sans-serif`;
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
  watermarkImage,
}: IDrawTradingViewNativeCanvasSceneOptions) {
  const paintStyles = getTradingViewNativeChartScenePaintStyles(colors);
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
      case 'rect': {
        const paint = getCanvasPaintStyle(
          command,
          customPaintStyles,
          paintStyles,
        );
        context.save();
        context.globalAlpha = paint.opacity;
        if (paint.drawStyle === 'stroke') {
          context.strokeStyle = paint.color;
          context.lineWidth = paint.strokeWidth ?? 1;
          context.strokeRect(
            command.x,
            command.y,
            command.width,
            command.height,
          );
        } else {
          context.fillStyle = paint.color;
          context.fillRect(command.x, command.y, command.width, command.height);
        }
        context.restore();
        break;
      }
      case 'restore':
        context.restore();
        break;
      case 'text': {
        const paint = getCanvasPaintStyle(
          command,
          customPaintStyles,
          paintStyles,
        );
        context.save();
        context.globalAlpha = paint.opacity;
        context.fillStyle = paint.color;
        context.font = getTradingViewNativeCanvasFont(command.font);
        context.textAlign = 'left';
        context.textBaseline = 'alphabetic';
        context.fillText(command.text, command.x, command.y);
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
