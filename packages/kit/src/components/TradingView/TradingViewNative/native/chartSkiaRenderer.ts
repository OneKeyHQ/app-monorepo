// cspell:ignore Alphaf Skia
import {
  ClipOp,
  FontSlant,
  FontWeight,
  FontWidth,
  PaintStyle,
  type SkCanvas,
  type SkFont,
  type SkFontMgr,
  type SkPaint,
  type SkPicture,
  type SkSVG,
  Skia,
  StrokeCap,
  StrokeJoin,
  TileMode,
  createPicture,
} from '@shopify/react-native-skia';

import {
  type IBuildTradingViewNativeChartSceneOptions,
  type ITradingViewNativeChartSceneColors,
  type ITradingViewNativeChartSceneCommand,
  type ITradingViewNativeChartSceneFont,
  type ITradingViewNativeChartScenePaint,
  type ITradingViewNativeChartScenePaintStyle,
  buildTradingViewNativeChartScene,
  getTradingViewNativeChartScenePaintStyles,
} from '../utils/chartScene';

export interface ITradingViewNativeSkiaResources {
  customPaintSignatures: Record<string, string>;
  customPaints: Record<string, SkPaint>;
  fonts: Record<ITradingViewNativeChartSceneFont, SkFont>;
  paints: Record<ITradingViewNativeChartScenePaint, SkPaint>;
  watermarkPaint: SkPaint;
  watermarkSvg: SkSVG | null;
}

const REGULAR_FONT_STYLE = {
  slant: FontSlant.Upright,
  weight: FontWeight.Normal,
  width: FontWidth.Normal,
} as const;

function doesTradingViewNativeSkiaFontSupportText(
  font: SkFont,
  text: string,
): boolean {
  return !text || font.getGlyphIDs(text).every((glyphId) => glyphId !== 0);
}

function createTradingViewNativeSkiaFont({
  fontFamily,
  fontManager,
  fontSize,
}: {
  fontFamily: string;
  fontManager: SkFontMgr;
  fontSize: number;
}): SkFont {
  'worklet';

  const typeface = fontManager.matchFamilyStyle(fontFamily, REGULAR_FONT_STYLE);
  return Skia.Font(typeface, fontSize);
}

export function createTradingViewNativeSkiaFontForText({
  fontFamily,
  fontSize,
  locale,
  requiredText,
}: {
  fontFamily: string;
  fontSize: number;
  locale: string;
  requiredText: string;
}): SkFont {
  const fontManager = Skia.FontMgr.System();
  const primaryFont = createTradingViewNativeSkiaFont({
    fontFamily,
    fontManager,
    fontSize,
  });
  const requiredCharacters = Array.from(requiredText);
  const primaryGlyphIds = primaryFont.getGlyphIDs(requiredText);
  const missingCharacters = requiredCharacters.filter(
    (_character, index) => primaryGlyphIds[index] === 0,
  );
  if (missingCharacters.length === 0) {
    return primaryFont;
  }

  const checkedCodePoints = new Set<number>();
  const bcp47 = locale ? [locale.replaceAll('_', '-')] : [];
  for (const missingCharacter of missingCharacters) {
    const codePoint = missingCharacter.codePointAt(0);
    if (codePoint !== undefined && !checkedCodePoints.has(codePoint)) {
      checkedCodePoints.add(codePoint);
      const fallbackTypeface = fontManager.matchFamilyStyleCharacter(
        fontFamily,
        REGULAR_FONT_STYLE,
        bcp47,
        codePoint,
      );
      if (fallbackTypeface) {
        const fallbackFont = Skia.Font(fallbackTypeface, fontSize);
        fallbackTypeface.dispose();
        const fallbackFontSupportsText =
          doesTradingViewNativeSkiaFontSupportText(fallbackFont, requiredText);
        if (fallbackFontSupportsText) {
          primaryFont.dispose();
          return fallbackFont;
        }
        fallbackFont.dispose();
      }
    }
  }

  return primaryFont;
}

export function getTradingViewNativeSkiaPaintStyleSignature(
  style: ITradingViewNativeChartScenePaintStyle,
): string {
  'worklet';

  const dash = style.dash
    ? `${style.dash[0].toString()}:${style.dash[1].toString()}`
    : '';
  return [
    `${style.color.length.toString()}:${style.color}`,
    dash,
    style.drawStyle ?? 'fill',
    style.opacity.toString(),
    style.strokeCap ?? 'butt',
    style.strokeJoin ?? 'miter',
    (style.strokeWidth ?? 1).toString(),
  ].join('|');
}

function createTradingViewNativeSkiaPaint(
  style: ITradingViewNativeChartScenePaintStyle,
): SkPaint {
  'worklet';

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
  return paint;
}

export function createTradingViewNativeSkiaResources({
  colors,
  fontFamily,
  legendFont,
  priceAxisFont,
  priceAxisFontSize,
  timeAxisFontSize,
  timeAxisBorderWidth,
  watermarkSvg,
}: {
  colors: ITradingViewNativeChartSceneColors;
  fontFamily: string;
  legendFont: SkFont;
  priceAxisFont: SkFont | null;
  priceAxisFontSize: number;
  timeAxisFontSize: number;
  timeAxisBorderWidth?: number;
  watermarkSvg: SkSVG | null;
}): ITradingViewNativeSkiaResources {
  'worklet';

  const paintStyles = getTradingViewNativeChartScenePaintStyles(colors, {
    timeAxisBorderWidth,
  });
  const paints = {} as Record<ITradingViewNativeChartScenePaint, SkPaint>;
  const fontManager = Skia.FontMgr.System();
  const axisFont = createTradingViewNativeSkiaFont({
    fontFamily,
    fontManager,
    fontSize: timeAxisFontSize,
  });
  const priceAxisFallbackFont = createTradingViewNativeSkiaFont({
    fontFamily,
    fontManager,
    fontSize: priceAxisFontSize,
  });

  for (const paintName of Object.keys(
    paintStyles,
  ) as ITradingViewNativeChartScenePaint[]) {
    const style = paintStyles[paintName];
    paints[paintName] = createTradingViewNativeSkiaPaint(style);
  }

  return {
    customPaintSignatures: {},
    customPaints: {},
    fonts: {
      axis: axisFont,
      legend: legendFont,
      priceAxis: priceAxisFont ?? priceAxisFallbackFont,
    },
    paints,
    watermarkPaint: Skia.Paint(),
    watermarkSvg,
  };
}

function synchronizeTradingViewNativeSkiaCustomPaints({
  customPaintStyles,
  resources,
}: {
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  resources: ITradingViewNativeSkiaResources;
}) {
  'worklet';

  const nextCustomPaints: Record<string, SkPaint> = {};
  const nextCustomPaintSignatures: Record<string, string> = {};
  for (const customPaintId of Object.keys(customPaintStyles)) {
    const style = customPaintStyles[customPaintId];
    const signature = getTradingViewNativeSkiaPaintStyleSignature(style);
    if (
      resources.customPaints[customPaintId] &&
      resources.customPaintSignatures[customPaintId] === signature
    ) {
      nextCustomPaints[customPaintId] = resources.customPaints[customPaintId];
    } else {
      resources.customPaints[customPaintId]?.dispose();
      nextCustomPaints[customPaintId] = createTradingViewNativeSkiaPaint(style);
    }
    nextCustomPaintSignatures[customPaintId] = signature;
  }
  for (const customPaintId of Object.keys(resources.customPaints)) {
    if (!nextCustomPaints[customPaintId]) {
      resources.customPaints[customPaintId].dispose();
    }
  }
  resources.customPaints = nextCustomPaints;
  resources.customPaintSignatures = nextCustomPaintSignatures;
}

function getTradingViewNativeSkiaCommandPaint({
  customPaintId,
  fallbackPaint,
  resources,
}: {
  customPaintId?: string;
  fallbackPaint: ITradingViewNativeChartScenePaint;
  resources: ITradingViewNativeSkiaResources;
}): SkPaint {
  'worklet';

  return (
    (customPaintId ? resources.customPaints[customPaintId] : undefined) ??
    resources.paints[fallbackPaint]
  );
}

function drawTradingViewNativeSkiaCommands({
  canvas,
  commands,
  customPaintStyles,
  resources,
}: {
  canvas: SkCanvas;
  commands: ITradingViewNativeChartSceneCommand[];
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  resources: ITradingViewNativeSkiaResources;
}) {
  'worklet';

  synchronizeTradingViewNativeSkiaCustomPaints({
    customPaintStyles,
    resources,
  });

  for (const command of commands) {
    switch (command.kind) {
      case 'circle':
        canvas.drawCircle(
          command.cx,
          command.cy,
          command.radius,
          getTradingViewNativeSkiaCommandPaint({
            customPaintId: command.customPaintId,
            fallbackPaint: command.paint,
            resources,
          }),
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
          getTradingViewNativeSkiaCommandPaint({
            customPaintId: command.customPaintId,
            fallbackPaint: command.paint,
            resources,
          }),
        );
        break;
      case 'linearGradientRect': {
        const paint = Skia.Paint();
        const shader = Skia.Shader.MakeLinearGradient(
          { x: command.rect.x, y: command.rect.y },
          {
            x: command.rect.x,
            y: command.rect.y + command.rect.height,
          },
          command.colors.map((color) => Skia.Color(color)),
          null,
          TileMode.Clamp,
        );
        paint.setShader(shader);
        canvas.drawRect(
          Skia.XYWHRect(
            command.rect.x,
            command.rect.y,
            command.rect.width,
            command.rect.height,
          ),
          paint,
        );
        shader.dispose();
        paint.dispose();
        break;
      }
      case 'polygon':
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
        if (command.kind === 'polygon') {
          path.close();
        }
        canvas.drawPath(
          path,
          getTradingViewNativeSkiaCommandPaint({
            customPaintId: command.customPaintId,
            fallbackPaint: command.paint,
            resources,
          }),
        );
        path.dispose();
        break;
      }
      case 'rect':
        canvas.drawRect(
          Skia.XYWHRect(command.x, command.y, command.width, command.height),
          getTradingViewNativeSkiaCommandPaint({
            customPaintId: command.customPaintId,
            fallbackPaint: command.paint,
            resources,
          }),
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
          getTradingViewNativeSkiaCommandPaint({
            customPaintId: command.customPaintId,
            fallbackPaint: command.paint,
            resources,
          }),
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
      customPaintStyles: scene.customPaintStyles,
      resources,
    });
  }, pictureSize);
}
