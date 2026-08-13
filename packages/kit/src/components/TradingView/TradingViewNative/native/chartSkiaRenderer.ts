// cspell:ignore Alphaf Skia
import {
  ClipOp,
  FontSlant,
  FontWeight,
  FontWidth,
  PaintStyle,
  type SkCanvas,
  type SkFont,
  type SkPaint,
  type SkPicture,
  type SkSVG,
  Skia,
  StrokeCap,
  StrokeJoin,
  createPicture,
} from '@shopify/react-native-skia';

import {
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE,
} from '../chartConstants';
import {
  type IBuildTradingViewNativeChartSceneOptions,
  type ITradingViewNativeChartSceneColors,
  type ITradingViewNativeChartSceneCommand,
  type ITradingViewNativeChartSceneFont,
  type ITradingViewNativeChartScenePaint,
  buildTradingViewNativeChartScene,
  getTradingViewNativeChartScenePaintStyles,
} from '../utils/chartScene';

export interface ITradingViewNativeSkiaResources {
  fonts: Record<ITradingViewNativeChartSceneFont, SkFont>;
  paints: Record<ITradingViewNativeChartScenePaint, SkPaint>;
  watermarkPaint: SkPaint;
  watermarkSvg: SkSVG | null;
}

export function createTradingViewNativeSkiaResources({
  colors,
  fontFamily,
  priceAxisFont,
  priceAxisFontSize,
  watermarkSvg,
}: {
  colors: ITradingViewNativeChartSceneColors;
  fontFamily: string;
  priceAxisFont: SkFont | null;
  priceAxisFontSize: number;
  watermarkSvg: SkSVG | null;
}): ITradingViewNativeSkiaResources {
  'worklet';

  const paintStyles = getTradingViewNativeChartScenePaintStyles(colors);
  const paints = {} as Record<ITradingViewNativeChartScenePaint, SkPaint>;
  const typeface = Skia.FontMgr.System().matchFamilyStyle(fontFamily, {
    slant: FontSlant.Upright,
    weight: FontWeight.Normal,
    width: FontWidth.Normal,
  });
  const axisFont = Skia.Font(typeface, TRADING_VIEW_NATIVE_AXIS_FONT_SIZE);
  const priceAxisFallbackFont = Skia.Font(typeface, priceAxisFontSize);

  for (const paintName of Object.keys(
    paintStyles,
  ) as ITradingViewNativeChartScenePaint[]) {
    const style = paintStyles[paintName];
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setColor(Skia.Color(style.color));
    paint.setAlphaf(paint.getAlphaf() * style.opacity);
    paint.setStrokeWidth(style.strokeWidth ?? 1);
    if (style.drawStyle === 'stroke') {
      paint.setStyle(PaintStyle.Stroke);
    }
    if (style.strokeCap === 'round') {
      paint.setStrokeCap(StrokeCap.Round);
    } else if (style.strokeCap === 'square') {
      paint.setStrokeCap(StrokeCap.Square);
    }
    if (style.strokeJoin === 'round') {
      paint.setStrokeJoin(StrokeJoin.Round);
    } else if (style.strokeJoin === 'bevel') {
      paint.setStrokeJoin(StrokeJoin.Bevel);
    }
    if (style.dash) {
      paint.setPathEffect(Skia.PathEffect.MakeDash(style.dash, 0));
    }
    paints[paintName] = paint;
  }

  return {
    fonts: {
      axis: axisFont,
      legend: Skia.Font(typeface, TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE),
      priceAxis: priceAxisFont ?? priceAxisFallbackFont,
    },
    paints,
    watermarkPaint: Skia.Paint(),
    watermarkSvg,
  };
}

function drawTradingViewNativeSkiaCommands({
  canvas,
  commands,
  resources,
}: {
  canvas: SkCanvas;
  commands: ITradingViewNativeChartSceneCommand[];
  resources: ITradingViewNativeSkiaResources;
}) {
  'worklet';

  for (const command of commands) {
    switch (command.kind) {
      case 'circle':
        canvas.drawCircle(
          command.cx,
          command.cy,
          command.radius,
          resources.paints[command.paint],
        );
        break;
      case 'clip':
        canvas.save();
        canvas.clipRect(
          Skia.XYWHRect(
            command.rect.x,
            command.rect.y,
            command.rect.width,
            command.rect.height,
          ),
          ClipOp.Intersect,
          true,
        );
        break;
      case 'line':
        canvas.drawLine(
          command.x1,
          command.y1,
          command.x2,
          command.y2,
          resources.paints[command.paint],
        );
        break;
      case 'polyline': {
        const firstPoint = command.points[0];
        if (!firstPoint) {
          break;
        }
        const path = Skia.Path.Make();
        path.moveTo(firstPoint.x, firstPoint.y);
        for (let index = 1; index < command.points.length; index += 1) {
          const point = command.points[index];
          path.lineTo(point.x, point.y);
        }
        canvas.drawPath(path, resources.paints[command.paint]);
        path.dispose();
        break;
      }
      case 'rect':
        canvas.drawRect(
          Skia.XYWHRect(command.x, command.y, command.width, command.height),
          resources.paints[command.paint],
        );
        break;
      case 'restore':
        canvas.restore();
        break;
      case 'text':
        canvas.drawText(
          command.text,
          command.x,
          command.y,
          resources.paints[command.paint],
          resources.fonts[command.font],
        );
        break;
      case 'watermark':
        if (resources.watermarkSvg) {
          canvas.save();
          canvas.translate(command.rect.x, command.rect.y);
          resources.watermarkPaint.setAlphaf(command.opacity);
          canvas.saveLayer(resources.watermarkPaint);
          canvas.drawSvg(
            resources.watermarkSvg,
            command.rect.width,
            command.rect.height,
          );
          canvas.restore();
          canvas.restore();
        }
        break;
      default:
        command satisfies never;
    }
  }
}

export function createTradingViewNativeSkiaPicture({
  resources,
  ...sceneOptions
}: Omit<IBuildTradingViewNativeChartSceneOptions, 'measureTextWidth'> & {
  resources: ITradingViewNativeSkiaResources;
}): SkPicture {
  'worklet';

  const scene = buildTradingViewNativeChartScene({
    ...sceneOptions,
    measureTextWidth: (text, font) =>
      resources.fonts[font].measureText(text).width,
  });

  const pictureSize =
    sceneOptions.height > 0 && sceneOptions.width > 0
      ? {
          height: sceneOptions.height,
          width: sceneOptions.width,
        }
      : undefined;

  return createPicture((canvas) => {
    'worklet';

    drawTradingViewNativeSkiaCommands({
      canvas,
      commands: scene.commands,
      resources,
    });
  }, pictureSize);
}
