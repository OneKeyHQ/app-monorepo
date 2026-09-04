export const TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION = 4 as const;
export const TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION = 2 as const;

export const TRADING_VIEW_NATIVE_THEME_COLORS = {
  background: '$bgApp',
  backgroundSubdued: '$bgSubdued',
  band: '$neutral9',
  brand: '$brand9',
  crosshair: '$textSubdued',
  grid: '$borderSubdued',
  indicatorPrimary: '$blue9',
  indicatorPrimarySubdued: '$blue3',
  indicatorSecondary: '$orange9',
  indicatorTertiary: '$purple9',
  negative: '$red9',
  negativeSubdued: '$red6',
  positive: '$green9',
  positiveSubdued: '$green6',
  quaternary: '$pink9',
  quinary: '$cyan9',
  referenceLine: '$textDisabled',
  warning: '$amber9',
} as const;

export type ITradingViewNativeThemeColor =
  (typeof TRADING_VIEW_NATIVE_THEME_COLORS)[keyof typeof TRADING_VIEW_NATIVE_THEME_COLORS];

export type ITradingViewNativeChartLineStyle = 'solid' | 'dashed';

export type ITradingViewNativeChartBackgroundStyle = 'solid' | 'gradient';

export type ITradingViewNativeChartGridStyle =
  | 'both'
  | 'horizontal'
  | 'vertical'
  | 'none';

export type ITradingViewNativeChartColorMode = 'modern' | 'classic';

export type ITradingViewNativeChartPriceColorMode =
  | 'greenUpRedDown'
  | 'redUpGreenDown';

export type ITradingViewNativeChartType =
  | 'area'
  | 'bars'
  | 'candlestick'
  | 'heikinAshi'
  | 'line';

export type ITradingViewNativeChartTypePreference =
  | 'auto'
  | ITradingViewNativeChartType;

export type ITradingViewNativeMainIndicatorId = 'MA' | 'EMA' | 'BOLL' | 'SAR';

export type ITradingViewNativeSubIndicatorId =
  | 'VOL'
  | 'MACD'
  | 'RSI'
  | 'StochRSI'
  | 'OBV'
  | 'MFI'
  | 'TRIX'
  | 'EMV'
  | 'WR'
  | 'ROC'
  | 'MTM'
  | 'DMI'
  | 'CCI';

export type ITradingViewNativeAnyIndicatorId =
  | ITradingViewNativeMainIndicatorId
  | ITradingViewNativeSubIndicatorId;

export type ITradingViewNativeIndicatorLineStyle =
  | 'solid'
  | 'medium'
  | 'bold'
  | 'extraBold'
  | 'dashed'
  | 'dotted';

export type ITradingViewNativeIndicatorLineSettings = {
  color: string;
  enabled: boolean;
  period: number;
  secondaryStyle?: ITradingViewNativeIndicatorLineStyle;
  style: ITradingViewNativeIndicatorLineStyle;
};

export type ITradingViewNativeIndicatorSettingsItem = {
  active: boolean;
  id: ITradingViewNativeAnyIndicatorId;
  lines: Record<string, ITradingViewNativeIndicatorLineSettings>;
  opacityColors?: {
    downColor: string;
    upColor: string;
  };
  parameters: Record<string, number>;
  transparency: number;
};

export type ITradingViewNativeIndicatorSettings = {
  schemaVersion: typeof TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION;
  mainIndicators: ITradingViewNativeIndicatorSettingsItem[];
  subIndicators: ITradingViewNativeIndicatorSettingsItem[];
};

export type ITradingViewNativeChartCandlePartSettings = {
  enabled: boolean;
  upColor: string;
  downColor: string;
};

export type ITradingViewNativeChartSettingsOptions = {
  yAxis: boolean;
  depth: boolean;
  priceChange: boolean;
  latestPrice: boolean;
  previousClose: boolean;
  futureEvents: boolean;
  pastEvents: boolean;
  clickInteraction: boolean;
  crossLine: boolean;
};

export type ITradingViewNativeChartSettings = {
  schemaVersion: typeof TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION;
  chartType: ITradingViewNativeChartTypePreference;
  candles: {
    body: ITradingViewNativeChartCandlePartSettings;
    border: ITradingViewNativeChartCandlePartSettings;
    wick: ITradingViewNativeChartCandlePartSettings;
  };
  options: ITradingViewNativeChartSettingsOptions;
  latestPriceLine: {
    upColor: string;
    downColor: string;
    style: ITradingViewNativeChartLineStyle;
  };
  background: {
    style: ITradingViewNativeChartBackgroundStyle;
    colors: [string, string];
  };
  grid: {
    style: ITradingViewNativeChartGridStyle;
    horizontalColor: string;
    verticalColor: string;
  };
  crossLine: {
    color: string;
    style: ITradingViewNativeChartLineStyle;
  };
  colorMode: ITradingViewNativeChartColorMode;
  priceColorMode: ITradingViewNativeChartPriceColorMode;
};

export function createTradingViewNativeChartSettings(): ITradingViewNativeChartSettings {
  const colors = TRADING_VIEW_NATIVE_THEME_COLORS;
  return {
    schemaVersion: TRADING_VIEW_NATIVE_CHART_SETTINGS_SCHEMA_VERSION,
    chartType: 'auto',
    candles: {
      body: {
        enabled: true,
        upColor: colors.positive,
        downColor: colors.negative,
      },
      border: {
        enabled: true,
        upColor: colors.positive,
        downColor: colors.negative,
      },
      wick: {
        enabled: true,
        upColor: colors.positive,
        downColor: colors.negative,
      },
    },
    options: {
      yAxis: true,
      depth: true,
      priceChange: true,
      latestPrice: true,
      previousClose: false,
      futureEvents: true,
      pastEvents: false,
      clickInteraction: false,
      crossLine: true,
    },
    latestPriceLine: {
      upColor: colors.positive,
      downColor: colors.negative,
      style: 'dashed',
    },
    background: {
      style: 'solid',
      colors: [colors.background, colors.backgroundSubdued],
    },
    grid: {
      style: 'both',
      horizontalColor: colors.grid,
      verticalColor: colors.grid,
    },
    crossLine: {
      color: colors.crosshair,
      style: 'dashed',
    },
    colorMode: 'classic',
    priceColorMode: 'greenUpRedDown',
  };
}

export function createTradingViewNativeIndicatorSettings(): ITradingViewNativeIndicatorSettings {
  return {
    schemaVersion: TRADING_VIEW_NATIVE_INDICATOR_SETTINGS_SCHEMA_VERSION,
    mainIndicators: [],
    subIndicators: [],
  };
}
