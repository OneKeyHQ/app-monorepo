// cspell:ignore Alphaf Skia XYWH

import {
  createTradingViewNativeSkiaFontForText,
  createTradingViewNativeSkiaPicture,
  createTradingViewNativeSkiaResources,
  getTradingViewNativeSkiaPaintStyleSignature,
} from './chartSkiaRenderer';

import type {
  ITradingViewNativeChartScene,
  ITradingViewNativeChartScenePaintStyle,
} from '../utils/chartScene';
import type { SkFont } from '@shopify/react-native-skia';

const mockBuildTradingViewNativeChartScene = jest.fn<
  ITradingViewNativeChartScene,
  [unknown]
>();
const mockCreatePaint = jest.fn(() => ({
  dispose: jest.fn(),
  getAlphaf: jest.fn(() => 1),
  setAlphaf: jest.fn(),
  setAntiAlias: jest.fn(),
  setColor: jest.fn(),
  setPathEffect: jest.fn(),
  setShader: jest.fn(),
  setStrokeCap: jest.fn(),
  setStrokeJoin: jest.fn(),
  setStrokeWidth: jest.fn(),
  setStyle: jest.fn(),
}));
const mockPath = {
  close: jest.fn(),
  dispose: jest.fn(),
  lineTo: jest.fn(),
  moveTo: jest.fn(),
};
const mockGradientShader = { dispose: jest.fn() };
let mockFontGlyphsByFamily: Record<string, string> = {};
let mockFontDisposeByFamily: Record<string, jest.Mock> = {};
let mockFallbackFontFamilyByRequest: Record<string, string> = {};
let mockFallbackTypefaceDisposeByFamily: Record<string, jest.Mock> = {};
let mockHasMatchFamilyStyleCharacter = true;
let mockSystemFontFamilies: string[] = [];
const mockCountFontFamilies = jest.fn(() => mockSystemFontFamilies.length);
const mockGetFontFamilyName = jest.fn(
  (index: number) => mockSystemFontFamilies[index],
);
const mockMatchFamilyStyleCharacter = jest.fn(
  (
    _fontFamily: string,
    _fontStyle: unknown,
    bcp47: string[],
    character: number,
  ) => {
    const fallbackFontFamily =
      mockFallbackFontFamilyByRequest[
        `${bcp47.at(-1) ?? ''}:${String.fromCodePoint(character)}`
      ];
    if (!fallbackFontFamily) {
      return null;
    }
    const dispose = jest.fn();
    mockFallbackTypefaceDisposeByFamily[fallbackFontFamily] = dispose;
    return { dispose, fontFamily: fallbackFontFamily };
  },
);
const mockSkiaFont = jest.fn<SkFont, [{ fontFamily: string }, number]>(
  (typeface: { fontFamily: string }, fontSize: number) => {
    const dispose = jest.fn();
    mockFontDisposeByFamily[typeface.fontFamily] = dispose;
    return {
      dispose,
      fontFamily: typeface.fontFamily,
      fontSize,
      getGlyphIDs: (text: string) =>
        Array.from(text).map((character) =>
          character.charCodeAt(0) <= 127 ||
          mockFontGlyphsByFamily[typeface.fontFamily]?.includes(character)
            ? 1
            : 0,
        ),
      measureText: (text: string) => ({ width: text.length }),
    } as unknown as SkFont;
  },
);
const mockCanvas = {
  clipRect: jest.fn(),
  drawCircle: jest.fn(),
  drawLine: jest.fn(),
  drawPath: jest.fn(),
  drawRect: jest.fn(),
  drawSvg: jest.fn(),
  drawText: jest.fn(),
  restore: jest.fn(),
  save: jest.fn(),
  saveLayer: jest.fn(),
  translate: jest.fn(),
};

jest.mock('../utils/chartScene', () => ({
  buildTradingViewNativeChartScene: (options: unknown) =>
    mockBuildTradingViewNativeChartScene(options),
  getTradingViewNativeChartScenePaintStyles: () => ({
    background: {
      color: '#000000',
      opacity: 1,
    },
  }),
}));

jest.mock('@shopify/react-native-skia', () => ({
  ClipOp: { Intersect: 0 },
  FontSlant: { Upright: 0 },
  FontWeight: { Normal: 0 },
  FontWidth: { Normal: 0 },
  PaintStyle: { Stroke: 1 },
  Skia: {
    Color: (color: string) => color,
    Font: (typeface: { fontFamily: string }, fontSize: number) =>
      mockSkiaFont(typeface, fontSize),
    FontMgr: {
      System: () => {
        const fontManager = {
          countFamilies: () => mockCountFontFamilies(),
          getFamilyName: (index: number) => mockGetFontFamilyName(index),
          matchFamilyStyle: (fontFamily: string) => ({ fontFamily }),
        };
        return mockHasMatchFamilyStyleCharacter
          ? {
              ...fontManager,
              matchFamilyStyleCharacter: (
                fontFamily: string,
                fontStyle: unknown,
                bcp47: string[],
                character: number,
              ) =>
                mockMatchFamilyStyleCharacter(
                  fontFamily,
                  fontStyle,
                  bcp47,
                  character,
                ),
            }
          : fontManager;
      },
    },
    Paint: () => mockCreatePaint(),
    Path: { Make: () => mockPath },
    PathEffect: { MakeDash: jest.fn() },
    Shader: { MakeLinearGradient: jest.fn(() => mockGradientShader) },
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      height,
      width,
      x,
      y,
    }),
  },
  StrokeCap: { Round: 1, Square: 2 },
  StrokeJoin: { Bevel: 1, Round: 2 },
  TileMode: { Clamp: 0 },
  createPicture: (
    draw: (canvas: typeof mockCanvas) => void,
    pictureSize?: { height: number; width: number },
  ) => {
    draw(mockCanvas);
    return { pictureSize };
  },
}));

const viewport = {
  offset: 0,
  zoomScale: 1,
};

function createScene(
  overrides: Partial<ITradingViewNativeChartScene> = {},
): ITradingViewNativeChartScene {
  return {
    autoPriceRange: null,
    commands: [],
    crosshairPointIndex: null,
    customPaintStyles: {},
    priceAxisWidth: 40,
    subIndicatorLegendHitRegions: [],
    viewport,
    visiblePointRange: { endIndex: 0, startIndex: 0 },
    ...overrides,
  };
}

function createResources({
  legendFont = mockSkiaFont({ fontFamily: 'System' }, 11),
}: {
  legendFont?: ReturnType<typeof mockSkiaFont>;
} = {}) {
  return createTradingViewNativeSkiaResources({
    colors: {
      axisText: '#999999',
      background: '#000000',
      grid: '#222222',
      line: '#ffffff',
    },
    fontFamily: 'System',
    legendFont,
    priceAxisFont: null,
    priceAxisFontSize: 12,
    timeAxisFontSize: 12,
    watermarkSvg: null,
  });
}

function createPicture(
  resources: ReturnType<typeof createTradingViewNativeSkiaResources>,
) {
  return createTradingViewNativeSkiaPicture({
    candleIntervalSeconds: 60,
    candleLabels: {
      close: 'C',
      high: 'H',
      low: 'L',
      open: 'O',
    },
    chartType: 'candlestick',
    crosshair: { visible: false, x: 0, y: 0 },
    hasVolume: false,
    height: 100,
    indicatorSeries: [],
    points: [],
    priceAxisWidth: 40,
    resources,
    subIndicatorPanes: [],
    viewport,
    watermarkOpacity: 0,
    width: 200,
  });
}

describe('TradingViewNative Skia scene renderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFontGlyphsByFamily = {};
    mockFontDisposeByFamily = {};
    mockFallbackFontFamilyByRequest = {};
    mockFallbackTypefaceDisposeByFamily = {};
    mockHasMatchFamilyStyleCharacter = true;
    mockSystemFontFamilies = [];
  });

  it('keeps the primary font without requesting a fallback when it has every glyph', () => {
    const legendText = '开高低收';
    mockFontGlyphsByFamily.System = legendText;

    const font = createTradingViewNativeSkiaFontForText({
      fontFamily: 'System',
      fontSize: 11,
      locale: 'zh-CN',
      requiredText: legendText,
    });

    expect(font).toEqual(expect.objectContaining({ fontFamily: 'System' }));
    expect(mockMatchFamilyStyleCharacter).not.toHaveBeenCalled();
    expect(mockFontDisposeByFamily.System).not.toHaveBeenCalled();
  });

  it('keeps the primary font when the system has no fallback', () => {
    const font = createTradingViewNativeSkiaFontForText({
      fontFamily: 'System',
      fontSize: 11,
      locale: 'zh-CN',
      requiredText: '开高低收',
    });

    expect(font).toEqual(expect.objectContaining({ fontFamily: 'System' }));
    expect(mockMatchFamilyStyleCharacter).toHaveBeenCalledTimes(4);
    expect(mockFontDisposeByFamily.System).not.toHaveBeenCalled();
  });

  it('scans system fonts when the native fallback API is unavailable', () => {
    const legendText = '开高低收';
    mockHasMatchFamilyStyleCharacter = false;
    mockSystemFontFamilies = ['Partial', 'PingFang SC', 'Later'];
    mockFontGlyphsByFamily.Partial = '开高';
    mockFontGlyphsByFamily['PingFang SC'] = legendText;
    mockFontGlyphsByFamily.Later = legendText;

    const font = createTradingViewNativeSkiaFontForText({
      fontFamily: 'System',
      fontSize: 11,
      locale: 'zh-CN',
      requiredText: legendText,
    });

    expect(font).toEqual(
      expect.objectContaining({ fontFamily: 'PingFang SC' }),
    );
    expect(mockMatchFamilyStyleCharacter).not.toHaveBeenCalled();
    expect(mockCountFontFamilies).toHaveBeenCalledTimes(1);
    expect(mockFontDisposeByFamily.System).toHaveBeenCalledTimes(1);
    expect(mockFontDisposeByFamily.Partial).toHaveBeenCalledTimes(1);
    expect(mockFontDisposeByFamily['PingFang SC']).not.toHaveBeenCalled();
    expect(mockFontDisposeByFamily.Later).toBeUndefined();
  });

  it.each([
    {
      expectedFontFamily: 'PingFang SC',
      legendText: '开高低收',
      locale: 'zh-CN',
    },
    {
      expectedFontFamily: 'PingFang TC',
      legendText: '開高低收',
      locale: 'zh-TW',
    },
    {
      expectedFontFamily: 'Noto Sans CJK JP',
      legendText: '始高安終',
      locale: 'ja-JP',
    },
    {
      expectedFontFamily: 'Noto Sans CJK KR',
      legendText: '시고저종',
      locale: 'ko-KR',
    },
  ])(
    'passes $locale to select the locale-specific $expectedFontFamily fallback',
    ({ expectedFontFamily, legendText, locale }) => {
      const firstCharacter = Array.from(legendText)[0] ?? '';
      mockFallbackFontFamilyByRequest[`${locale}:${firstCharacter}`] =
        expectedFontFamily;
      mockFontGlyphsByFamily[expectedFontFamily] = legendText;

      const font = createTradingViewNativeSkiaFontForText({
        fontFamily: 'System',
        fontSize: 11,
        locale,
        requiredText: legendText,
      });

      expect(font).toEqual(
        expect.objectContaining({ fontFamily: expectedFontFamily }),
      );
      expect(mockMatchFamilyStyleCharacter).toHaveBeenCalledWith(
        'System',
        expect.any(Object),
        [locale],
        firstCharacter.codePointAt(0),
      );
      expect(mockFontDisposeByFamily.System).toHaveBeenCalledTimes(1);
      expect(
        mockFontDisposeByFamily[expectedFontFamily],
      ).not.toHaveBeenCalled();
      expect(
        mockFallbackTypefaceDisposeByFamily[expectedFontFamily],
      ).toHaveBeenCalledTimes(1);
    },
  );

  it('disposes an incomplete fallback before selecting a complete fallback', () => {
    const legendText = '开高低收';
    mockFallbackFontFamilyByRequest['zh-CN:开'] = 'Partial';
    mockFallbackFontFamilyByRequest['zh-CN:高'] = 'Complete';
    mockFontGlyphsByFamily.Partial = '开高';
    mockFontGlyphsByFamily.Complete = legendText;

    const font = createTradingViewNativeSkiaFontForText({
      fontFamily: 'System',
      fontSize: 11,
      locale: 'zh_CN',
      requiredText: legendText,
    });

    expect(font).toEqual(expect.objectContaining({ fontFamily: 'Complete' }));
    expect(mockFontDisposeByFamily.Partial).toHaveBeenCalledTimes(1);
    expect(mockFontDisposeByFamily.Complete).not.toHaveBeenCalled();
    expect(mockFallbackTypefaceDisposeByFamily.Partial).toHaveBeenCalledTimes(
      1,
    );
    expect(mockFallbackTypefaceDisposeByFamily.Complete).toHaveBeenCalledTimes(
      1,
    );
  });

  it('builds resources with the resolved legend font without another lookup', () => {
    const legendFont = mockSkiaFont(
      { fontFamily: 'Anonymous Android fallback' },
      11,
    );
    const resources = createResources({ legendFont });

    expect(resources.fonts.legend).toBe(legendFont);
    expect(mockMatchFamilyStyleCharacter).not.toHaveBeenCalled();
    expect(mockCountFontFamilies).not.toHaveBeenCalled();
    expect(mockGetFontFamilyName).not.toHaveBeenCalled();
  });

  it('creates one cached SkPaint per stable custom style', () => {
    const resources = createResources();
    const staticPaintCount = mockCreatePaint.mock.calls.length;
    const customStyle: ITradingViewNativeChartScenePaintStyle = {
      color: '#123456',
      drawStyle: 'stroke',
      opacity: 0.4,
      strokeWidth: 2,
    };
    mockBuildTradingViewNativeChartScene.mockReturnValue(
      createScene({
        commands: [
          {
            customPaintId: 'pane.line',
            height: 10,
            kind: 'rect',
            paint: 'background',
            width: 2,
            x: 1,
            y: 1,
          },
          {
            customPaintId: 'pane.line',
            height: 20,
            kind: 'rect',
            paint: 'background',
            width: 2,
            x: 4,
            y: 1,
          },
        ],
        customPaintStyles: { 'pane.line': customStyle },
      }),
    );

    createPicture(resources);
    const cachedPaint = resources.customPaints['pane.line'];
    const cachedPaintMock = cachedPaint as unknown as ReturnType<
      typeof mockCreatePaint
    >;
    createPicture(resources);

    expect(mockCreatePaint).toHaveBeenCalledTimes(staticPaintCount + 1);
    expect(resources.customPaints['pane.line']).toBe(cachedPaint);
    expect(mockCanvas.drawRect).toHaveBeenCalledTimes(4);

    mockBuildTradingViewNativeChartScene.mockReturnValue(
      createScene({
        customPaintStyles: {
          'pane.line': { ...customStyle, opacity: 0.8 },
        },
      }),
    );
    createPicture(resources);

    expect(mockCreatePaint).toHaveBeenCalledTimes(staticPaintCount + 2);
    expect(resources.customPaints['pane.line']).not.toBe(cachedPaint);
    expect(cachedPaintMock.dispose).toHaveBeenCalledTimes(1);
    const replacementPaintMock = resources.customPaints[
      'pane.line'
    ] as unknown as ReturnType<typeof mockCreatePaint>;
    expect(replacementPaintMock.dispose).not.toHaveBeenCalled();
  });

  it('disposes cached custom paints when their styles are removed', () => {
    const resources = createResources();
    mockBuildTradingViewNativeChartScene.mockReturnValue(
      createScene({
        customPaintStyles: {
          'pane.hidden': { color: '#123456', opacity: 1 },
        },
      }),
    );
    createPicture(resources);
    const hiddenPaint = resources.customPaints['pane.hidden'];
    const hiddenPaintMock = hiddenPaint as unknown as ReturnType<
      typeof mockCreatePaint
    >;

    mockBuildTradingViewNativeChartScene.mockReturnValue(createScene());
    createPicture(resources);

    expect(hiddenPaintMock.dispose).toHaveBeenCalledTimes(1);
    expect(resources.customPaints).toEqual({});
    expect(resources.customPaintSignatures).toEqual({});
  });

  it('closes polygon paths and draws them with the custom paint', () => {
    const resources = createResources();
    mockBuildTradingViewNativeChartScene.mockReturnValue(
      createScene({
        commands: [
          {
            customPaintId: 'pane.fill',
            kind: 'polygon',
            paint: 'background',
            points: [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
              { x: 5, y: 2 },
            ],
          },
        ],
        customPaintStyles: {
          'pane.fill': { color: '#abcdef', opacity: 0.25 },
        },
      }),
    );

    createPicture(resources);

    expect(mockPath.moveTo).toHaveBeenCalledWith(1, 2);
    expect(mockPath.lineTo).toHaveBeenNthCalledWith(1, 3, 4);
    expect(mockPath.lineTo).toHaveBeenNthCalledWith(2, 5, 2);
    expect(mockPath.close).toHaveBeenCalledTimes(1);
    expect(mockCanvas.drawPath).toHaveBeenCalledWith(
      mockPath,
      resources.customPaints['pane.fill'],
    );
    expect(mockPath.dispose).toHaveBeenCalledTimes(1);
  });

  it('uses the semantic fallback when a custom paint is unavailable', () => {
    const resources = createResources();
    mockBuildTradingViewNativeChartScene.mockReturnValue(
      createScene({
        commands: [
          {
            customPaintId: 'missing.paint',
            height: 4,
            kind: 'rect',
            paint: 'background',
            width: 3,
            x: 1,
            y: 2,
          },
        ],
      }),
    );

    createPicture(resources);

    expect(mockCanvas.drawRect).toHaveBeenCalledWith(
      { height: 4, width: 3, x: 1, y: 2 },
      resources.paints.background,
    );
  });

  it('normalizes default paint fields in the style signature', () => {
    const implicitDefaults = getTradingViewNativeSkiaPaintStyleSignature({
      color: '#123456',
      opacity: 1,
    });
    const explicitDefaults = getTradingViewNativeSkiaPaintStyleSignature({
      color: '#123456',
      drawStyle: 'fill',
      opacity: 1,
      strokeCap: 'butt',
      strokeJoin: 'miter',
      strokeWidth: 1,
    });

    expect(implicitDefaults).toBe(explicitDefaults);
    expect(
      getTradingViewNativeSkiaPaintStyleSignature({
        color: '#123456',
        opacity: 0.5,
      }),
    ).not.toBe(implicitDefaults);
  });

  it('draws and disposes a vertical gradient background', () => {
    const resources = createResources();
    mockBuildTradingViewNativeChartScene.mockReturnValue(
      createScene({
        commands: [
          {
            colors: ['#010203', '#040506'],
            kind: 'linearGradientRect',
            rect: { height: 100, width: 200, x: 0, y: 0 },
          },
        ],
      }),
    );

    createPicture(resources);

    expect(
      jest.requireMock('@shopify/react-native-skia').Skia.Shader
        .MakeLinearGradient,
    ).toHaveBeenCalledWith(
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      ['#010203', '#040506'],
      null,
      0,
    );
    expect(mockCanvas.drawRect).toHaveBeenCalledWith(
      { height: 100, width: 200, x: 0, y: 0 },
      expect.any(Object),
    );
    expect(mockGradientShader.dispose).toHaveBeenCalledTimes(1);
  });
});
