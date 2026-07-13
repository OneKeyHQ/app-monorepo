export type ITradingViewSettingsMockAppearanceSectionId =
  | 'candles'
  | 'coordinates'
  | 'events'
  | 'layout';

export type ITradingViewSettingsMockLineStyle =
  | 'solid'
  | 'medium'
  | 'bold'
  | 'extraBold'
  | 'dashed'
  | 'dotted';

export type ITradingViewSettingsMockColorRole = 'up' | 'down';

export const TRADING_VIEW_SETTINGS_SCHEMA_VERSION = 1 as const;

export type ITradingViewSettingsMockIndicatorScope = 'main' | 'sub';

export type ITradingViewSettingsMockIcon =
  | 'TradingViewCandlesOutline'
  | 'RandomCrossoverOutline'
  | 'ClockTimeHistoryOutline'
  | 'LayoutGrid2Outline';

export type ITradingViewSettingsMockLine = {
  id: string;
  label: string;
  enabled: boolean;
  period: number;
  color: string;
  style: ITradingViewSettingsMockLineStyle;
  secondaryStyle?: ITradingViewSettingsMockLineStyle;
  colorPattern?: 'checker';
  showPeriod?: boolean;
  showStyle?: boolean;
  showCheckbox?: boolean;
  showColor?: boolean;
  showSecondaryStyle?: boolean;
  colorOffset?: number;
  colorPickerPlacement?: 'bottom' | 'top';
};

export type ITradingViewSettingsMockNumberParam = {
  id: string;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  rowId?: string;
  rowLabel?: string;
};

export type ITradingViewSettingsMockIndicator = {
  id: string;
  label: string;
  title: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
  opacity: number;
  opacityColors?: {
    upColor: string;
    downColor: string;
  };
  showOpacity?: boolean;
  description?: string;
  parameters?: ITradingViewSettingsMockNumberParam[];
  lines: ITradingViewSettingsMockLine[];
};

export type ITradingViewSettingsMockAppearanceItem = {
  id: string;
  label: string;
  enabled: boolean;
  upColor: string;
  downColor: string;
};

export type ITradingViewSettingsMockAppearanceSection = {
  id: ITradingViewSettingsMockAppearanceSectionId;
  label: string;
  icon: ITradingViewSettingsMockIcon;
  items: ITradingViewSettingsMockAppearanceItem[];
};

export type ITradingViewChartSettingsLineStyle = 'solid' | 'dashed';

export type ITradingViewChartSettingsBackgroundStyle = 'solid' | 'gradient';

export type ITradingViewChartSettingsGridStyle =
  | 'both'
  | 'horizontal'
  | 'vertical'
  | 'none';

export type ITradingViewChartSettingsColorMode = 'modern' | 'classic';

export type ITradingViewChartSettingsPriceColorMode =
  | 'greenUpRedDown'
  | 'redUpGreenDown';

export type ITradingViewChartSettingsOptions = {
  countdown: boolean;
  depth: boolean;
  priceChange: boolean;
  latestPrice: boolean;
  futureEvents: boolean;
  pastEvents: boolean;
  clickInteraction: boolean;
  crossLine: boolean;
};

export type ITradingViewChartSettingsValue = {
  schemaVersion: typeof TRADING_VIEW_SETTINGS_SCHEMA_VERSION;
  appearanceSections: ITradingViewSettingsMockAppearanceSection[];
  options: ITradingViewChartSettingsOptions;
  latestPriceLine: {
    upColor: string;
    downColor: string;
    style: ITradingViewChartSettingsLineStyle;
  };
  background: {
    style: ITradingViewChartSettingsBackgroundStyle;
    colors: [string, string];
  };
  grid: {
    style: ITradingViewChartSettingsGridStyle;
    horizontalColor: string;
    verticalColor: string;
  };
  crossLine: {
    color: string;
    style: ITradingViewChartSettingsLineStyle;
  };
  colorMode: ITradingViewChartSettingsColorMode;
  priceColorMode: ITradingViewChartSettingsPriceColorMode;
};

export type ITradingViewIndicatorSettingsValue = {
  schemaVersion: typeof TRADING_VIEW_SETTINGS_SCHEMA_VERSION;
  indicators: ITradingViewSettingsMockIndicator[];
};

const DEFAULT_APPEARANCE_SECTIONS: ITradingViewSettingsMockAppearanceSection[] =
  [
    {
      id: 'candles',
      label: 'K line',
      icon: 'TradingViewCandlesOutline',
      items: [
        {
          id: 'body',
          label: 'Body',
          enabled: true,
          upColor: '#219D46',
          downColor: '#C33759',
        },
        {
          id: 'border',
          label: 'Border',
          enabled: true,
          upColor: '#219D46',
          downColor: '#C33759',
        },
        {
          id: 'wick',
          label: 'Wick',
          enabled: true,
          upColor: '#219D46',
          downColor: '#C33759',
        },
      ],
    },
    {
      id: 'coordinates',
      label: 'Coordinates',
      icon: 'RandomCrossoverOutline',
      items: [
        {
          id: 'crosshair',
          label: 'Crosshair',
          enabled: true,
          upColor: '#8A8D97',
          downColor: '#8A8D97',
        },
        {
          id: 'price-label',
          label: 'Price label',
          enabled: true,
          upColor: '#23A55A',
          downColor: '#D94B7A',
        },
      ],
    },
    {
      id: 'events',
      label: 'Events',
      icon: 'ClockTimeHistoryOutline',
      items: [
        {
          id: 'orders',
          label: 'Orders',
          enabled: true,
          upColor: '#F5A524',
          downColor: '#5AC8FA',
        },
        {
          id: 'fills',
          label: 'Fills',
          enabled: false,
          upColor: '#23A55A',
          downColor: '#D94B7A',
        },
      ],
    },
    {
      id: 'layout',
      label: 'Layout',
      icon: 'LayoutGrid2Outline',
      items: [
        {
          id: 'background',
          label: 'Background',
          enabled: true,
          upColor: '#151517',
          downColor: '#232529',
        },
        {
          id: 'grid',
          label: 'Grid',
          enabled: true,
          upColor: '#2A2D32',
          downColor: '#2A2D32',
        },
      ],
    },
  ];

function createVolumeIndicator({
  id,
  scope,
  groupLabel,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label: 'VOLUME',
    title: 'VOLUME (成交量)',
    scope,
    groupLabel,
    active,
    opacity: scope === 'sub' ? 50 : 100,
    showOpacity: true,
    description:
      '该指标统计了在特定时间内市场上的数字货币成交量，展示了市场活跃度。',
    lines: [
      {
        id: `${id}-vol`,
        label: 'VOL',
        enabled: true,
        period: 0,
        color: '#FFA726',
        style: 'solid',
        showCheckbox: false,
        showPeriod: false,
        showStyle: false,
      },
      {
        id: `${id}-ma1`,
        label: 'MA1',
        enabled: scope !== 'sub',
        period: 5,
        color: '#EC407A',
        style: 'solid',
        showCheckbox: true,
        showPeriod: true,
        showStyle: true,
      },
      {
        id: `${id}-ma2`,
        label: 'MA2',
        enabled: scope !== 'sub',
        period: 10,
        color: '#27C6DA',
        style: 'solid',
        showCheckbox: true,
        showPeriod: true,
        showStyle: true,
      },
    ],
  };
}

function createMovingAverageIndicator({
  id,
  label,
  linePrefix,
  title,
  description,
  scope,
  active,
}: {
  id: string;
  label: string;
  linePrefix: string;
  title: string;
  description: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  const periods = [5, 10, 20, 30, 60, 120];
  const colors = [
    '#FF9D22',
    '#E9386F',
    '#23BFD5',
    '#F27206',
    '#734DBA',
    '#76C079',
  ];
  return {
    id,
    label,
    title,
    scope,
    active,
    opacity: 100,
    showOpacity: false,
    description,
    lines: periods.map((period, index) => ({
      id: `${id}-${linePrefix.toLowerCase()}${index + 1}`,
      label: `${linePrefix}${index + 1}`,
      enabled: index < 3,
      period,
      color: colors[index] ?? '#FF9D22',
      style: 'solid',
      showCheckbox: true,
      showPeriod: true,
      showStyle: true,
    })),
  };
}

function createMovingAverageConvergenceDivergenceIndicator({
  id,
  scope,
  groupLabel,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label: 'MACD',
    title: 'MACD (指数平滑异同移动平均线)',
    scope,
    groupLabel,
    active,
    opacity: 100,
    showOpacity: false,
    parameters: [
      { id: `${id}-short`, label: '短周期', value: 12 },
      { id: `${id}-long`, label: '长周期', value: 26 },
      { id: `${id}-signal`, label: '移动平均周期', value: 9 },
    ],
    description:
      '该指标通过衡量两条移动平均线之间的差异以及它们的趋同和趋异，提示潜在的变化趋势。“短周期”和“长周期”分别指用于短期和长期移动平均线的周期数。“MA 周期”指计算 MACD 线移动平均的周期。DIF 则代表短期和长期移动平均线之间的差异值，DEA 代表 DIF 线的移动平均值。',
    lines: [
      {
        id: `${id}-dif`,
        label: 'DIF',
        enabled: true,
        period: 0,
        color: '#FFA726',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: true,
      },
      {
        id: `${id}-dea`,
        label: 'DEA',
        enabled: true,
        period: 0,
        color: '#EC407A',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: true,
      },
      {
        id: `${id}-histogram`,
        label: 'MACD',
        enabled: true,
        period: 0,
        color: '#27C6DA',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: false,
      },
    ],
  };
}

function createAverageLineIndicator({
  id,
  scope,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label: 'AVL',
    title: 'AVL (均价线)',
    scope,
    active,
    opacity: 100,
    showOpacity: false,
    description:
      '该指标可以表示选定周期内的平均价格水平，平滑短期价格波动，帮助判断价格所处的相对高低位置，可用于分析趋势方向和潜在支撑阻力。',
    lines: [
      {
        id: `${id}-line`,
        label: 'AVL',
        enabled: true,
        period: 0,
        color: '#FF9D22',
        style: 'solid',
        showCheckbox: false,
        showPeriod: false,
        showStyle: true,
      },
    ],
  };
}

function createPriceBandIndicator({
  id,
  scope,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label: 'BOLL',
    title: 'BOLL (布林线)',
    scope,
    active,
    opacity: 100,
    showOpacity: false,
    parameters: [
      { id: `${id}-period`, label: '计算周期', value: 20 },
      { id: `${id}-deviation`, label: '标准差', value: 2 },
    ],
    description:
      '该指标通过中轨和上下轨展示价格波动区间，帮助判断价格是否接近相对高位或低位。',
    lines: [
      {
        id: `${id}-middle`,
        label: 'BOLL',
        enabled: true,
        period: 0,
        color: '#F27206',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: true,
      },
      {
        id: `${id}-upper`,
        label: 'UB',
        enabled: true,
        period: 0,
        color: '#FF9D22',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: true,
      },
      {
        id: `${id}-lower`,
        label: 'LB',
        enabled: true,
        period: 0,
        color: '#FF9D22',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: true,
      },
      {
        id: `${id}-background`,
        label: '背景',
        enabled: true,
        period: 0,
        color: '#3A2A1E',
        colorPattern: 'checker',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: false,
      },
    ],
  };
}

function createParabolicStopAndReverseIndicator({
  id,
  scope,
  groupLabel,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label: 'SAR',
    title: 'SAR (停损点指向指标)',
    scope,
    groupLabel,
    active,
    opacity: 100,
    showOpacity: false,
    description:
      '该指标基于趋势展示，旨在通过提供市场趋势反转的信号，展示潜在的进场和离场点位。',
    lines: [
      {
        id: `${id}-line`,
        label: 'SAR',
        enabled: true,
        period: 0,
        color: '#27C6DA',
        style: 'solid',
        showCheckbox: false,
        showPeriod: false,
        showStyle: false,
        colorOffset: 176,
      },
    ],
  };
}

function createSuperTrendIndicator({
  id,
  scope,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label: '超级趋势',
    title: '超级趋势',
    scope,
    active,
    opacity: 100,
    showOpacity: false,
    parameters: [
      { id: `${id}-atr`, label: 'ATR 长度', value: 14 },
      { id: `${id}-multiplier`, label: '乘数', value: 3 },
    ],
    description:
      '该指标通过平均真实波动区间 (ATR) 反映市场趋势和潜在反转。它通过 ATR 长度衡量波动性，并按照乘数设置区间距离。',
    lines: [
      {
        id: `${id}-up`,
        label: '上升趋势',
        enabled: true,
        period: 0,
        color: '#43A646',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: true,
      },
      {
        id: `${id}-up-background`,
        label: '背景',
        enabled: true,
        period: 0,
        color: '#1E3D23',
        colorPattern: 'checker',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: false,
      },
      {
        id: `${id}-down`,
        label: '下降趋势',
        enabled: true,
        period: 0,
        color: '#F02F3C',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: true,
      },
      {
        id: `${id}-down-background`,
        label: '背景',
        enabled: true,
        period: 0,
        color: '#3A2028',
        colorPattern: 'checker',
        style: 'solid',
        showCheckbox: true,
        showPeriod: false,
        showStyle: false,
      },
    ],
  };
}

function createVolumeWeightedAveragePriceIndicator({
  id,
  scope,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label: 'VWAP',
    title: 'VWAP',
    scope,
    active,
    opacity: 100,
    showOpacity: false,
    description:
      '该指标计算一定数量 K 线的交易量加权均价。长度用于设置计算周期，帮助判断短期趋势、支撑阻力以及当前价格是否处于合理区间。',
    lines: [
      {
        id: `${id}-line`,
        label: '长度',
        enabled: true,
        period: 14,
        color: '#23BFD5',
        style: 'solid',
        showCheckbox: false,
        showPeriod: true,
        showStyle: true,
      },
    ],
  };
}

function createSupportResistanceIndicator({
  id,
  scope,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label: '撑压线',
    title: '撑压线 (resistance and support lines)',
    scope,
    active,
    opacity: 100,
    showOpacity: false,
    parameters: [{ id: `${id}-tick`, label: '每行 tick 数', value: 10 }],
    description:
      '该指标是一套基于成交量分布原理的支撑/压力分析工具，通过分析历史成交量在不同价格区间的分布情况，动态生成支撑线和压力线，辅助识别价格高概率会停顿、反转或震荡的区域。',
    lines: [
      {
        id: `${id}-resistance`,
        label: '压力线',
        enabled: true,
        period: 0,
        color: '#E9386F',
        style: 'solid',
        secondaryStyle: 'dashed',
        showCheckbox: false,
        showPeriod: false,
        showStyle: true,
        showSecondaryStyle: true,
      },
      {
        id: `${id}-support`,
        label: '支撑线',
        enabled: true,
        period: 0,
        color: '#FF9D22',
        style: 'solid',
        secondaryStyle: 'dashed',
        showCheckbox: false,
        showPeriod: false,
        showStyle: true,
        showSecondaryStyle: true,
      },
    ],
  };
}

function createOpenInterestIndicator({
  id,
  groupLabel,
  active,
}: {
  id: string;
  groupLabel?: string;
  active: boolean;
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label: 'OI',
    title: '持仓量',
    scope: 'sub',
    groupLabel,
    active,
    opacity: 100,
    showOpacity: false,
    description: '持仓量是指该交易对的多仓或空仓总量。',
    lines: [
      {
        id: `${id}-line`,
        label: 'OI',
        enabled: true,
        period: 0,
        color: '#5191F5',
        style: 'solid',
        showCheckbox: false,
        showPeriod: false,
        showStyle: true,
        colorPickerPlacement: 'bottom',
      },
    ],
  };
}

function createLongShortRatioIndicator({
  id,
  label,
  title,
  groupLabel,
  active,
  description,
}: {
  id: string;
  label: string;
  title: string;
  groupLabel?: string;
  active: boolean;
  description: string;
}) {
  return createTechnicalIndicator({
    id,
    label,
    title,
    scope: 'sub',
    groupLabel,
    active,
    showOpacity: false,
    description,
    lines: [
      {
        label: 'Ratio',
        color: '#F27206',
        showCheckbox: true,
        showPeriod: false,
        showStyle: true,
      },
      {
        label: '净多仓',
        color: '#76C079',
        showCheckbox: false,
        showPeriod: false,
        showStyle: false,
        colorOffset: 40,
      },
      {
        label: '净空仓',
        color: '#A13EB4',
        showCheckbox: false,
        showPeriod: false,
        showStyle: false,
        colorOffset: 40,
      },
    ],
  });
}

function createTakerBuySellIndicator({
  id,
  groupLabel,
  active,
}: {
  id: string;
  groupLabel?: string;
  active: boolean;
}) {
  return createTechnicalIndicator({
    id,
    label: 'Taker B/S',
    title: 'Taker B/S (主动买卖量)',
    scope: 'sub',
    groupLabel,
    active,
    showOpacity: false,
    description:
      '主动买入量：单位时间内主动买入的成交量。\n主动卖出量：单位时间内主动卖出的成交量。',
    lines: [
      {
        label: 'Buy',
        color: '#76C079',
        showCheckbox: false,
        showPeriod: false,
        showStyle: false,
        colorOffset: 154,
      },
      {
        label: 'Sell',
        color: '#A13EB4',
        showCheckbox: false,
        showPeriod: false,
        showStyle: false,
        colorOffset: 154,
      },
    ],
  });
}

const OKX_INDICATOR_LINE_COLORS = [
  '#FFA726',
  '#EC407A',
  '#27C6DA',
  '#E65000',
  '#734DBA',
  '#76C079',
];

type ITradingViewSettingsMockTechnicalLineConfig = {
  label: string;
  enabled?: boolean;
  period?: number;
  color?: string;
  style?: ITradingViewSettingsMockLineStyle;
  showCheckbox?: boolean;
  showPeriod?: boolean;
  showStyle?: boolean;
  showColor?: boolean;
  colorPattern?: 'checker';
  colorOffset?: number;
  secondaryStyle?: ITradingViewSettingsMockLineStyle;
  showSecondaryStyle?: boolean;
};

function createTechnicalIndicator({
  id,
  label,
  title = label,
  scope,
  groupLabel,
  active,
  opacity = 100,
  showOpacity = false,
  parameters,
  description,
  lines,
}: {
  id: string;
  label: string;
  title?: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
  opacity?: number;
  showOpacity?: boolean;
  parameters?: ITradingViewSettingsMockNumberParam[];
  description?: string;
  lines: ITradingViewSettingsMockTechnicalLineConfig[];
}): ITradingViewSettingsMockIndicator {
  return {
    id,
    label,
    title,
    scope,
    groupLabel,
    active,
    opacity,
    showOpacity,
    parameters,
    description,
    lines: lines.map((line, index) => ({
      id: `${id}-line-${index + 1}`,
      label: line.label,
      enabled: line.enabled ?? true,
      period: line.period ?? 0,
      color:
        line.color ??
        OKX_INDICATOR_LINE_COLORS[index % OKX_INDICATOR_LINE_COLORS.length],
      style: line.style ?? 'solid',
      colorPattern: line.colorPattern,
      showCheckbox: line.showCheckbox ?? true,
      showPeriod: line.showPeriod ?? typeof line.period === 'number',
      showStyle: line.showStyle ?? true,
      showColor: line.showColor ?? true,
      colorOffset: line.colorOffset,
      secondaryStyle: line.secondaryStyle,
      showSecondaryStyle: line.showSecondaryStyle,
    })),
  };
}

function createKdjIndicator({
  id,
  scope,
  groupLabel,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
}) {
  return createTechnicalIndicator({
    id,
    label: 'KDJ',
    title: 'KDJ (随机指标)',
    scope,
    groupLabel,
    active,
    parameters: [
      { id: `${id}-period`, label: '计算周期', value: 9 },
      {
        id: `${id}-m1`,
        label: 'K',
        value: 3,
        rowId: `${id}-ma-period`,
        rowLabel: '移动平均周期',
      },
      {
        id: `${id}-m2`,
        label: 'D',
        value: 3,
        rowId: `${id}-ma-period`,
        rowLabel: '移动平均周期',
      },
    ],
    description:
      '该指标是一个动量震荡指标，通过比较特定时期内的收盘价与价格范围，展示超买或超卖条件。K 代表当前价格相对于特定时期最高价格的百分比。D 代表 K 的简单移动平均。J 代表当前价格相对于特定时期最低价格的百分比。',
    lines: [{ label: 'K' }, { label: 'D' }, { label: 'J' }],
  });
}

function createSlowKDJIndicator({
  id,
  scope,
  groupLabel,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
}) {
  return createTechnicalIndicator({
    id,
    label: 'SKDJ',
    title: 'SKDJ (慢速随机指标)',
    scope,
    groupLabel,
    active,
    parameters: [
      { id: `${id}-period`, label: '计算周期', value: 9 },
      { id: `${id}-m`, label: '移动平均周期', value: 3 },
    ],
    description:
      '该指标是一个动量震荡指标，通过比较特定时期内的收盘价与价格范围，展示超买或超卖条件。相较于标准 KDJ，SKDJ 的计算周期更长、波动更为平滑，可以减少短期波动带来的干扰，提供更为准确的市场信号。K 代表当前价格相对于特定时期最高价格的百分比。D 代表 K 的简单移动平均。',
    lines: [{ label: 'K' }, { label: 'D' }],
  });
}

function createStochasticRSIIndicator({
  id,
  scope,
  groupLabel,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
}) {
  return createTechnicalIndicator({
    id,
    label: 'StochRSI',
    title: 'StochRSI (随机相对强弱指数)',
    scope,
    groupLabel,
    active,
    parameters: [
      { id: `${id}-rsi`, label: 'RSI 天数长度', value: 14 },
      { id: `${id}-stochastic`, label: '随机指标长度', value: 14 },
      { id: `${id}-k`, label: 'K', value: 3 },
      { id: `${id}-d`, label: 'D', value: 3 },
    ],
    description:
      '该指标通过计算 RSI 在特定时期最高值和最低值区间中的相对位置，展示超买或超卖条件。STOCHRSI 代表随机相对强弱指数的当前值，MASTOCHRSI 则代表 STOCHRSI 线的移动平均值。',
    lines: [{ label: 'STOCHRSI' }, { label: 'MASTOCHRSI' }],
  });
}

function createRsiIndicator({
  id,
  scope,
  groupLabel,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
}) {
  return createTechnicalIndicator({
    id,
    label: 'RSI',
    title: 'RSI (相对强弱指标)',
    scope,
    groupLabel,
    active,
    description: '该指标通过衡量价格运动的速度与变化，展示超买或超卖的条件。',
    lines: [
      {
        label: 'UB',
        period: 70,
        color: '#3279F5',
        showStyle: false,
        secondaryStyle: 'dashed',
        showSecondaryStyle: true,
      },
      {
        label: 'LB',
        period: 30,
        color: '#3279F5',
        showStyle: false,
        secondaryStyle: 'dashed',
        showSecondaryStyle: true,
      },
      {
        label: '背景',
        color: 'rgba(50, 121, 245, 0.08)',
        colorPattern: 'checker',
        showPeriod: false,
        showStyle: false,
      },
      { label: 'RSI1', period: 6 },
      { label: 'RSI2', period: 12 },
      { label: 'RSI3', period: 24 },
    ],
  });
}

function createDmiIndicator({
  id,
  scope,
  groupLabel,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
}) {
  return createTechnicalIndicator({
    id,
    label: 'DMI',
    title: 'DMI (动向指标)',
    scope,
    groupLabel,
    active,
    parameters: [
      { id: `${id}-period`, label: 'N', value: 14 },
      { id: `${id}-m`, label: 'MM', value: 6 },
    ],
    description:
      '该指标通过比较价格的上涨和下跌幅度，展示趋势方向和趋势强度。PDI 代表上升动向，MDI 代表下降动向，ADX 代表趋势强度，ADXR 则代表 ADX 的移动平均值。',
    lines: [
      { label: 'PDI' },
      { label: 'MDI' },
      { label: 'ADX' },
      { label: 'ADXR' },
    ],
  });
}

function createSubPriceBandIndicator({
  id,
  scope,
  groupLabel,
  active,
}: {
  id: string;
  scope: ITradingViewSettingsMockIndicatorScope;
  groupLabel?: string;
  active: boolean;
}) {
  return createTechnicalIndicator({
    id,
    label: 'BOLL',
    title: 'BOLL (布林线)',
    scope,
    groupLabel,
    active,
    showOpacity: false,
    parameters: [
      { id: `${id}-period`, label: '计算周期', value: 20 },
      { id: `${id}-deviation`, label: '标准差', value: 2 },
    ],
    description:
      '该指标根据价格的变化创建了一个价格通道，展示了价格波动以及潜在的反转点。UB 和 LB 分别代表布林通道的上限和下限。',
    lines: [
      { label: 'BOLL', color: '#E65000' },
      { label: 'UB', color: '#FFA726' },
      { label: 'LB', color: '#FFA726' },
      {
        label: '背景',
        color: '#3A2A1E',
        colorPattern: 'checker',
        showStyle: false,
      },
    ],
  });
}

function createBasicSubIndicator({
  id,
  label,
  title = label,
  groupLabel,
  active,
  parameters,
  lines,
  description,
}: {
  id: string;
  label: string;
  title?: string;
  groupLabel?: string;
  active: boolean;
  parameters?: ITradingViewSettingsMockNumberParam[];
  lines: ITradingViewSettingsMockTechnicalLineConfig[];
  description?: string;
}) {
  return createTechnicalIndicator({
    id,
    label,
    title,
    scope: 'sub',
    groupLabel,
    active,
    parameters,
    description,
    lines,
  });
}

const DEFAULT_INDICATORS: ITradingViewSettingsMockIndicator[] = [
  createVolumeIndicator({
    id: 'main-volume',
    scope: 'main',
    active: true,
  }),
  createMovingAverageIndicator({
    id: 'main-ma',
    label: 'MA',
    linePrefix: 'MA',
    title: 'MA (移动平均线)',
    description:
      '该指标通过计算特定时期内数字货币的平均价格，展示了平滑的趋势线。',
    scope: 'main',
    active: true,
  }),
  createMovingAverageIndicator({
    id: 'main-ema',
    label: 'EMA',
    linePrefix: 'EMA',
    title: 'EMA (指数移动平均线)',
    description:
      '该指标更加注重近期价格的变化。相较于简单的移动平均线，指数移动平均线对最新价格赋予更高权重。',
    scope: 'main',
    active: false,
  }),
  createMovingAverageIndicator({
    id: 'main-wma',
    label: 'WMA',
    linePrefix: 'WMA',
    title: 'WMA (加权移动平均线)',
    description:
      '该指标是一种对不同周期价格赋予不同权重的移动平均指标，近期价格通常拥有更高权重。',
    scope: 'main',
    active: false,
  }),
  createAverageLineIndicator({
    id: 'main-avl',
    scope: 'main',
    active: false,
  }),
  createPriceBandIndicator({
    id: 'main-boll',
    scope: 'main',
    active: false,
  }),
  createParabolicStopAndReverseIndicator({
    id: 'main-sar',
    scope: 'main',
    active: false,
  }),
  createSuperTrendIndicator({
    id: 'main-supertrend',
    scope: 'main',
    active: false,
  }),
  createVolumeWeightedAveragePriceIndicator({
    id: 'main-vwap',
    scope: 'main',
    active: false,
  }),
  createSupportResistanceIndicator({
    id: 'main-pressure',
    scope: 'main',
    active: false,
  }),
  createOpenInterestIndicator({
    id: 'sub-oi',
    groupLabel: '交易指标',
    active: false,
  }),
  createLongShortRatioIndicator({
    id: 'sub-top-account-ls',
    label: 'Top Acc. L/S',
    title: 'Top Account Long/Short Ratio',
    groupLabel: '交易指标',
    active: false,
    description:
      '该指标展示大户账户多空人数比例，用于观察主要交易账户的方向偏好。',
  }),
  createLongShortRatioIndicator({
    id: 'sub-top-position-ls',
    label: 'Top Pos. L/S',
    title: 'Top Position Long/Short Ratio',
    groupLabel: '交易指标',
    active: false,
    description: '该指标展示大户持仓多空比例，用于观察主要持仓资金的方向偏好。',
  }),
  createLongShortRatioIndicator({
    id: 'sub-account-ls',
    label: 'Acc. L/S',
    title: 'Account Long/Short Ratio',
    groupLabel: '交易指标',
    active: false,
    description: '该指标展示账户多空人数比例，用于观察整体交易账户的方向分布。',
  }),
  createTakerBuySellIndicator({
    id: 'sub-taker-bs',
    groupLabel: '交易指标',
    active: false,
  }),
  createVolumeIndicator({
    id: 'sub-volume',
    scope: 'sub',
    groupLabel: '基本指标',
    active: true,
  }),
  createMovingAverageConvergenceDivergenceIndicator({
    id: 'sub-macd',
    scope: 'sub',
    groupLabel: '基本指标',
    active: false,
  }),
  createKdjIndicator({
    id: 'sub-kdj',
    scope: 'sub',
    groupLabel: '基本指标',
    active: false,
  }),
  createSlowKDJIndicator({
    id: 'sub-skdj',
    scope: 'sub',
    groupLabel: '基本指标',
    active: false,
  }),
  createStochasticRSIIndicator({
    id: 'sub-stoch-rsi',
    scope: 'sub',
    groupLabel: '基本指标',
    active: false,
  }),
  createRsiIndicator({
    id: 'sub-rsi',
    scope: 'sub',
    groupLabel: '基本指标',
    active: false,
  }),
  createDmiIndicator({
    id: 'sub-dmi',
    scope: 'sub',
    groupLabel: '基本指标',
    active: false,
  }),
  createBasicSubIndicator({
    id: 'sub-obv',
    label: 'OBV',
    title: 'OBV (能量潮指标)',
    groupLabel: '基本指标',
    active: false,
    description:
      '该指标通过衡量买卖压力，揭示趋势的变化强度。MAOBV 代表 OBV 线的移动平均值。',
    lines: [{ label: 'OBV' }, { label: 'MAOBV', period: 30 }],
  }),
  createSubPriceBandIndicator({
    id: 'sub-boll',
    scope: 'sub',
    groupLabel: '基本指标',
    active: false,
  }),
  createParabolicStopAndReverseIndicator({
    id: 'sub-sar',
    scope: 'sub',
    groupLabel: '基本指标',
    active: false,
  }),
  createBasicSubIndicator({
    id: 'sub-dma',
    label: 'DMA',
    groupLabel: '基本指标',
    active: false,
    parameters: [
      { id: 'sub-dma-short', label: '短周期', value: 10 },
      { id: 'sub-dma-long', label: '长周期', value: 50 },
    ],
    description:
      '该指标可以计算出两个移动平均线之间的差异，以确定趋势的方向以及潜在的入场及离场点位。DMA 代表移动平均差异的当前值，AMA 则代表 DMA 线的移动平均值。',
    lines: [{ label: 'DMA' }, { label: 'AMA', period: 10 }],
  }),
  createBasicSubIndicator({
    id: 'sub-trix',
    label: 'TRIX',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-trix-period', label: '移动平均周期', value: 12 }],
    description:
      '该指标是一个动量震荡指标，可以过滤市场噪音并识别趋势。TRIX 代表三重指数平均的当前值，MATRIX 则代表 TRIX 线的移动平均值。',
    lines: [{ label: 'TRIX' }, { label: 'MATRIX', period: 9 }],
  }),
  createBasicSubIndicator({
    id: 'sub-brar',
    label: 'BRAR',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-brar-period', label: '计算周期', value: 26 }],
    description:
      '该指标通过衡量买卖压力之间的关系，展示市场情绪。BR 代表当前收盘价与特定时期最低收盘价的比值。AR 代表当前收盘价与特定时期最高收盘价的比值。',
    lines: [{ label: 'BR' }, { label: 'AR' }],
  }),
  createBasicSubIndicator({
    id: 'sub-vr',
    label: 'VR',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-vr-period', label: '计算周期', value: 26 }],
    description:
      '该指标通过衡量上涨的交易量与下跌的交易量之间的比率，展示市场情绪。它聚焦于成交量数据，而非上涨或下跌资产的数量。VR 代表波动率比率当前的数值，MAVR 则代表 VR 线的移动平均值。',
    lines: [{ label: 'VR' }, { label: 'MAVR', period: 6 }],
  }),
  createBasicSubIndicator({
    id: 'sub-emv',
    label: 'EMV',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-emv-period', label: '移动平均周期', value: 14 }],
    description:
      '该指标通过衡量价格移动的难易程度，展示了趋势的变化强度。EMV 代表价格移动难易程度的当前数值，MAEMV 则代表 EMV 线的移动平均值。',
    lines: [{ label: 'EMV' }, { label: 'MAEMV', period: 9 }],
  }),
  createBasicSubIndicator({
    id: 'sub-wr',
    label: 'WR',
    groupLabel: '基本指标',
    active: false,
    title: 'WR (威廉姆斯指标)',
    description:
      '该指标通过将特定期间内收盘价与最低最高价的差值作比较，来衡量超买或超卖条件。',
    lines: [
      { label: 'WR1', period: 10 },
      { label: 'WR2', period: 6 },
    ],
  }),
  createBasicSubIndicator({
    id: 'sub-roc',
    label: 'ROC',
    title: 'ROC (变化速率)',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-roc-period', label: '计算周期', value: 12 }],
    description:
      '该指标通过衡量特定期间价格的百分比变化，展示趋势的动量。ROC 代表变化率当前的数值，MAROC 则代表 ROC 线的移动平均值。',
    lines: [{ label: 'ROC' }, { label: 'MAROC', period: 6 }],
  }),
  createBasicSubIndicator({
    id: 'sub-mtm',
    label: 'MTM',
    title: 'MTM (动量指标)',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-mtm-period', label: '计算周期', value: 12 }],
    description:
      '该指标通过衡量当前价格与若干个周期前的价格之间的差异，展示趋势的变化强度。MTM 代表动量当前的数值，MAMTM 则代表 MTM 线的移动平均值。',
    lines: [{ label: 'MTM' }, { label: 'MAMTM', period: 6 }],
  }),
  createBasicSubIndicator({
    id: 'sub-psy',
    label: 'PSY',
    title: 'PSY (心理线指标)',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-psy-period', label: '计算周期', value: 12 }],
    description:
      '该指标计算上涨的周期数与总周期数的比值，代表了市场上买卖压力之间的平衡关系。\n当 PSY 大于 50% 时，意味着买方主导市场，看涨情绪居多；当 PSY 小于 50% 时，意味着卖方占据上风，看跌情绪居多。',
    lines: [{ label: 'PSY' }, { label: 'MAPSY', period: 6 }],
  }),
  createBasicSubIndicator({
    id: 'sub-cci',
    label: 'CCI',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-cci-period', label: '计算周期', value: 14 }],
    description:
      '该指标通过衡量当前价格水平与平均价格水平之间的关系，展示了超买或超卖条件。',
    lines: [{ label: 'CCI' }],
  }),
  createBasicSubIndicator({
    id: 'sub-nvi',
    label: 'NVI',
    title: 'NVI (负成交量指标)',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-nvi-ema', label: 'EMA 周期', value: 255 }],
    description:
      '该指标关注成交量萎缩时的价格变化，用于追踪主力资金的潜在动向。仅在当日成交量低于前一日时，指标值才会根据价格涨跌更新，成交量增加时指标保持不变。NVI 持续上升说明缩量阶段价格走强，通常被视为主力低调买入的信号。建议配合移动平均线使用，以识别潜在趋势方向。',
    lines: [{ label: 'NVI' }, { label: 'MANVI' }],
  }),
  createBasicSubIndicator({
    id: 'sub-pvt',
    label: 'PVT',
    title: 'PVT (价量趋势)',
    groupLabel: '基本指标',
    active: false,
    description:
      '该指标是结合价格变化和交易量的动量指标，用于衡量资金流动并确认趋势。相较于 OBV 指标仅根据涨跌方向累加或扣减交易量，PVT 更加关注价格涨跌幅度，可以更准确地反映趋势强弱。',
    lines: [{ label: 'PVT', showPeriod: false }],
  }),
  createBasicSubIndicator({
    id: 'sub-pmo',
    label: 'PMO',
    title: 'PMO (价格动量震荡指标)',
    groupLabel: '基本指标',
    active: false,
    parameters: [
      { id: 'sub-pmo-length-1', label: '长度 1', value: 35 },
      { id: 'sub-pmo-length-2', label: '长度 2', value: 20 },
      { id: 'sub-pmo-signal', label: '信号长度', value: 10 },
    ],
    description:
      '该指标通过对价格变化率 (ROC) 进行双重指数平滑处理，衡量价格的中长期动量变化。PMO 线代表经过两次平滑后的动量值，信号线代表 PMO 线的指数移动平均值。PMO 线上穿信号线为买入参考，下穿为卖出参考。',
    lines: [{ label: 'PMO' }, { label: '信号' }],
  }),
  createBasicSubIndicator({
    id: 'sub-rvi',
    label: 'RVI',
    title: 'RVI (相对活力指数)',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-rvi-length', label: '长度', value: 10 }],
    description:
      '该指标追踪价格波动的方向，衡量价格随时间变化的标准差。数值高于 50 表示上行波动增强，低于 50 表示下行压力上升。',
    lines: [{ label: 'RVI' }, { label: '信号' }],
  }),
  createBasicSubIndicator({
    id: 'sub-tsi',
    label: '真实强弱指数',
    groupLabel: '基本指标',
    active: false,
    parameters: [
      { id: 'sub-tsi-long', label: '长周期', value: 25 },
      { id: 'sub-tsi-short', label: '短周期', value: 13 },
      { id: 'sub-tsi-signal', label: '信号长度', value: 13 },
    ],
    description:
      '该指标通过对价格变化量及其绝对值分别进行双重指数平滑处理，衡量价格动量的方向与强度。TSI 线代表双重平滑后的价格动量值，数值范围在 -100 至 +100 之间；信号线代表 TSI 线的指数移动平均值。TSI 线上穿信号线为买入参考，下穿为卖出参考；TSI 高于 0 表示多头动量主导，低于 0 表示空头动量主导。',
    lines: [{ label: 'TSI' }, { label: '信号' }],
  }),
  createBasicSubIndicator({
    id: 'sub-rci-ribbon',
    label: 'RCI ribbon',
    title: 'RCI ribbon (顺位相关系数带)',
    groupLabel: '基本指标',
    active: false,
    parameters: [
      { id: 'sub-rci-short', label: '短周期', value: 10 },
      { id: 'sub-rci-medium', label: '中周期', value: 30 },
      { id: 'sub-rci-long', label: '长周期', value: 50 },
    ],
    description:
      '该指标通过绘制三条不同回溯周期的顺位相关系数震荡线，直观呈现多个时间维度下价格走势方向的一致性。与普通动量指标不同，RCI 衡量的是时间序号与价格排名之间的相关程度，对价格的相对顺序更为敏感。\n三条 RCI 线同向运动说明各周期趋势一致。短周期线与长周期线方向背离，则提示短期走势可能偏离长期结构。RCI 值趋近 +100 代表强烈上升趋势，趋近 -100 代表强烈下降趋势。',
    lines: [{ label: '短周期' }, { label: '中周期' }, { label: '长周期' }],
  }),
  createBasicSubIndicator({
    id: 'sub-kst',
    label: 'KST',
    title: 'KST (确定趋势)',
    groupLabel: '基本指标',
    active: false,
    parameters: [
      { id: 'sub-kst-roc-1', label: 'ROC 周期 1', value: 10 },
      { id: 'sub-kst-roc-2', label: 'ROC 周期 2', value: 15 },
      { id: 'sub-kst-roc-3', label: 'ROC 周期 3', value: 20 },
      { id: 'sub-kst-roc-4', label: 'ROC 周期 4', value: 30 },
      { id: 'sub-kst-sma-1', label: 'SMA 周期 1', value: 10 },
      { id: 'sub-kst-sma-2', label: 'SMA 周期 2', value: 10 },
      { id: 'sub-kst-sma-3', label: 'SMA 周期 3', value: 10 },
      { id: 'sub-kst-sma-4', label: 'SMA 周期 4', value: 15 },
      { id: 'sub-kst-signal', label: '信号线长度', value: 9 },
    ],
    description:
      '该指标是一种基于动量的震荡指标，以价格变化率 (ROC) 为计算基础，用于识别中长期趋势的方向与强度。KST 线代表四周期加权变化率的平滑均值，信号长度线代表 KST 线的移动平均值。KST 线上穿信号长度线为买入参考，下穿为卖出参考。',
    lines: [{ label: 'KST' }, { label: 'Signal' }],
  }),
  createBasicSubIndicator({
    id: 'sub-mfi',
    label: 'MFI',
    title: 'MFI (资金流量指数)',
    groupLabel: '基本指标',
    active: false,
    parameters: [
      { id: 'sub-mfi-period', label: '时间周期', value: 14 },
      { id: 'sub-mfi-overbought', label: '超买', value: 80 },
      { id: 'sub-mfi-oversold', label: '超卖', value: 20 },
    ],
    description:
      '该指标是基于价格和成交量的动量指标，用于衡量市场资金流入和流出的强弱。',
    lines: [
      { label: 'MFI' },
      {
        label: 'OB',
        color: '#3279F5',
        showStyle: false,
        secondaryStyle: 'dashed',
        showSecondaryStyle: true,
      },
      {
        label: 'OS',
        color: '#3279F5',
        showStyle: false,
        secondaryStyle: 'dashed',
        showSecondaryStyle: true,
      },
      {
        label: '背景',
        color: 'rgba(50, 121, 245, 0.08)',
        colorPattern: 'checker',
        showStyle: false,
      },
    ],
  }),
  createBasicSubIndicator({
    id: 'sub-mass-index',
    label: 'Mass Index',
    title: 'Mass index (梅斯线)',
    groupLabel: '基本指标',
    active: false,
    parameters: [{ id: 'sub-mass-index-length', label: '长度', value: 10 }],
    description:
      '该指标通过分析特定周期内价格区间的扩张与收缩幅度，判断趋势反转时机。当价格区间显著扩大后回落收窄，则认为极可能即将出现价格反转。',
    lines: [{ label: 'Mass Index' }],
  }),
  createBasicSubIndicator({
    id: 'sub-qqe',
    label: 'QQE',
    title: 'QQE (定量定性估计)',
    groupLabel: '基本指标',
    active: false,
    parameters: [
      { id: 'sub-qqe-fast', label: 'Fast × 1,000', value: 2618 },
      { id: 'sub-qqe-slow', label: 'Slow × 1,000', value: 4236 },
      { id: 'sub-qqe-rsi', label: 'RSI', value: 14 },
      { id: 'sub-qqe-slow-factor', label: '慢速因子', value: 2 },
    ],
    description:
      '该指标是一种趋势跟踪指标。基于 RSI 构建的平滑动能指标，通过快慢双信号线生成买卖信号，可以有效减少误报。',
    lines: [
      { label: 'RSIndex' },
      { label: 'FastAtrRSI' },
      { label: 'SlowAtrRSI' },
    ],
  }),
];

function cloneAppearanceSections() {
  return DEFAULT_APPEARANCE_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item })),
  }));
}

function cloneIndicators() {
  return DEFAULT_INDICATORS.map((indicator) => ({
    ...indicator,
    opacityColors: indicator.opacityColors
      ? { ...indicator.opacityColors }
      : {
          upColor: '#219D46',
          downColor: '#C33759',
        },
    parameters: indicator.parameters?.map((parameter) => ({ ...parameter })),
    lines: indicator.lines.map((line) => ({ ...line })),
  }));
}

export function createTradingViewChartSettingsValue(): ITradingViewChartSettingsValue {
  return {
    schemaVersion: TRADING_VIEW_SETTINGS_SCHEMA_VERSION,
    appearanceSections: cloneAppearanceSections(),
    options: {
      countdown: true,
      depth: true,
      priceChange: true,
      latestPrice: true,
      futureEvents: true,
      pastEvents: false,
      clickInteraction: false,
      crossLine: true,
    },
    latestPriceLine: {
      upColor: '#219D46',
      downColor: '#C33759',
      style: 'dashed',
    },
    background: {
      style: 'solid',
      colors: ['#000000', '#171717'],
    },
    grid: {
      style: 'both',
      horizontalColor: '#171717',
      verticalColor: '#171717',
    },
    crossLine: {
      color: '#BFC3CF',
      style: 'dashed',
    },
    colorMode: 'classic',
    priceColorMode: 'greenUpRedDown',
  };
}

export function createTradingViewIndicatorSettingsValue(): ITradingViewIndicatorSettingsValue {
  return {
    schemaVersion: TRADING_VIEW_SETTINGS_SCHEMA_VERSION,
    indicators: cloneIndicators(),
  };
}

export function getTradingViewSettingsMockIndicatorsByScope(
  state: ITradingViewIndicatorSettingsValue,
  scope: ITradingViewSettingsMockIndicatorScope,
) {
  return state.indicators.filter((indicator) => indicator.scope === scope);
}

export function getDefaultTradingViewIndicatorIdForScope(
  indicators: ITradingViewSettingsMockIndicator[],
  scope: ITradingViewSettingsMockIndicatorScope,
) {
  const scopedIndicators = indicators.filter(
    (indicator) => indicator.scope === scope,
  );
  const preferredIndicator = scopedIndicators.find(
    (indicator) => indicator.id === 'sub-volume',
  );
  const activeIndicator = scopedIndicators.find(
    (indicator) => indicator.active,
  );

  return (
    preferredIndicator?.id ??
    activeIndicator?.id ??
    scopedIndicators[0]?.id ??
    ''
  );
}

export function toggleTradingViewSettingsMockIndicator(
  state: ITradingViewIndicatorSettingsValue,
  indicatorId: string,
  active: boolean,
  maxActiveSubIndicators = 4,
): ITradingViewIndicatorSettingsValue {
  const activeSubIndicatorLimit = Number.isFinite(maxActiveSubIndicators)
    ? Math.max(0, Math.floor(maxActiveSubIndicators))
    : 4;
  const targetIndicator = state.indicators.find(
    (indicator) => indicator.id === indicatorId,
  );
  if (!targetIndicator) {
    return state;
  }

  if (
    active &&
    targetIndicator.scope === 'sub' &&
    !targetIndicator.active &&
    state.indicators.filter(
      (indicator) => indicator.scope === 'sub' && indicator.active,
    ).length >= activeSubIndicatorLimit
  ) {
    return state;
  }

  let changed = false;
  const indicators = state.indicators.map((indicator) => {
    if (indicator.id !== indicatorId) {
      return indicator;
    }

    changed = changed || indicator.active !== active;
    return {
      ...indicator,
      active,
    };
  });

  return changed
    ? {
        ...state,
        indicators,
      }
    : state;
}

export function toggleTradingViewSettingsMockLine(
  state: ITradingViewIndicatorSettingsValue,
  lineId: string,
  enabled: boolean,
): ITradingViewIndicatorSettingsValue {
  let changed = false;
  const indicators = state.indicators.map((indicator) => {
    let indicatorChanged = false;
    const lines = indicator.lines.map((line) => {
      if (line.id !== lineId) {
        return line;
      }

      indicatorChanged = indicatorChanged || line.enabled !== enabled;
      changed = changed || line.enabled !== enabled;
      return {
        ...line,
        enabled,
      };
    });

    return indicatorChanged
      ? {
          ...indicator,
          lines,
        }
      : indicator;
  });

  return changed
    ? {
        ...state,
        indicators,
      }
    : state;
}

export function updateTradingViewSettingsMockLineColor(
  state: ITradingViewIndicatorSettingsValue,
  lineId: string,
  color: string,
): ITradingViewIndicatorSettingsValue {
  let changed = false;
  const indicators = state.indicators.map((indicator) => {
    let indicatorChanged = false;
    const lines = indicator.lines.map((line) => {
      if (line.id !== lineId) {
        return line;
      }

      indicatorChanged = indicatorChanged || line.color !== color;
      changed = changed || line.color !== color;
      return {
        ...line,
        color,
      };
    });

    return indicatorChanged
      ? {
          ...indicator,
          lines,
        }
      : indicator;
  });

  return changed
    ? {
        ...state,
        indicators,
      }
    : state;
}

export function updateTradingViewSettingsMockLinePeriod(
  state: ITradingViewIndicatorSettingsValue,
  lineId: string,
  period: number,
): ITradingViewIndicatorSettingsValue {
  const nextPeriod = Number.isFinite(period) ? Math.max(0, period) : 0;
  let changed = false;
  const indicators = state.indicators.map((indicator) => {
    let indicatorChanged = false;
    const lines = indicator.lines.map((line) => {
      if (line.id !== lineId) {
        return line;
      }

      indicatorChanged = indicatorChanged || line.period !== nextPeriod;
      changed = changed || line.period !== nextPeriod;
      return {
        ...line,
        period: nextPeriod,
      };
    });

    return indicatorChanged
      ? {
          ...indicator,
          lines,
        }
      : indicator;
  });

  return changed
    ? {
        ...state,
        indicators,
      }
    : state;
}

export function updateTradingViewSettingsMockLineStyle(
  state: ITradingViewIndicatorSettingsValue,
  lineId: string,
  style: ITradingViewSettingsMockLineStyle,
): ITradingViewIndicatorSettingsValue {
  let changed = false;
  const indicators = state.indicators.map((indicator) => {
    let indicatorChanged = false;
    const lines = indicator.lines.map((line) => {
      if (line.id !== lineId) {
        return line;
      }

      indicatorChanged = indicatorChanged || line.style !== style;
      changed = changed || line.style !== style;
      return {
        ...line,
        style,
      };
    });

    return indicatorChanged
      ? {
          ...indicator,
          lines,
        }
      : indicator;
  });

  return changed
    ? {
        ...state,
        indicators,
      }
    : state;
}

export function updateTradingViewSettingsMockLineSecondaryStyle(
  state: ITradingViewIndicatorSettingsValue,
  lineId: string,
  secondaryStyle: ITradingViewSettingsMockLineStyle,
): ITradingViewIndicatorSettingsValue {
  let changed = false;
  const indicators = state.indicators.map((indicator) => {
    let indicatorChanged = false;
    const lines = indicator.lines.map((line) => {
      if (line.id !== lineId) {
        return line;
      }

      indicatorChanged =
        indicatorChanged || line.secondaryStyle !== secondaryStyle;
      changed = changed || line.secondaryStyle !== secondaryStyle;
      return {
        ...line,
        secondaryStyle,
      };
    });

    return indicatorChanged
      ? {
          ...indicator,
          lines,
        }
      : indicator;
  });

  return changed
    ? {
        ...state,
        indicators,
      }
    : state;
}

export function updateTradingViewSettingsMockIndicatorOpacity(
  state: ITradingViewIndicatorSettingsValue,
  indicatorId: string,
  opacity: number,
): ITradingViewIndicatorSettingsValue {
  const nextOpacity = Number.isFinite(opacity)
    ? Math.min(100, Math.max(0, opacity))
    : 0;
  let changed = false;
  const indicators = state.indicators.map((indicator) => {
    if (indicator.id !== indicatorId) {
      return indicator;
    }

    changed = changed || indicator.opacity !== nextOpacity;
    return {
      ...indicator,
      opacity: nextOpacity,
    };
  });

  return changed
    ? {
        ...state,
        indicators,
      }
    : state;
}

export function updateTradingViewSettingsMockIndicatorOpacityColor(
  state: ITradingViewIndicatorSettingsValue,
  indicatorId: string,
  role: ITradingViewSettingsMockColorRole,
  color: string,
): ITradingViewIndicatorSettingsValue {
  let changed = false;
  const indicators = state.indicators.map((indicator) => {
    if (indicator.id !== indicatorId) {
      return indicator;
    }

    const opacityColors = indicator.opacityColors ?? {
      upColor: '#219D46',
      downColor: '#C33759',
    };
    const colorKey = role === 'up' ? 'upColor' : 'downColor';
    if (opacityColors[colorKey] === color) {
      return indicator;
    }

    changed = true;
    return {
      ...indicator,
      opacityColors: {
        ...opacityColors,
        [colorKey]: color,
      },
    };
  });

  return changed
    ? {
        ...state,
        indicators,
      }
    : state;
}

export function updateTradingViewSettingsMockIndicatorParameter(
  state: ITradingViewIndicatorSettingsValue,
  parameterId: string,
  value: number,
): ITradingViewIndicatorSettingsValue {
  let changed = false;
  const indicators = state.indicators.map((indicator) => {
    let indicatorChanged = false;
    const parameters = indicator.parameters?.map((parameter) => {
      if (parameter.id !== parameterId) {
        return parameter;
      }

      const min = parameter.min ?? 0;
      const max = parameter.max ?? Number.POSITIVE_INFINITY;
      const nextValue = Number.isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : min;
      indicatorChanged = indicatorChanged || parameter.value !== nextValue;
      changed = changed || parameter.value !== nextValue;
      return {
        ...parameter,
        value: nextValue,
      };
    });

    return indicatorChanged
      ? {
          ...indicator,
          parameters,
        }
      : indicator;
  });

  return changed
    ? {
        ...state,
        indicators,
      }
    : state;
}

export function toggleTradingViewSettingsMockAppearanceItem(
  state: ITradingViewChartSettingsValue,
  itemId: string,
  enabled: boolean,
): ITradingViewChartSettingsValue {
  let changed = false;
  const appearanceSections = state.appearanceSections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      changed = changed || item.enabled !== enabled;
      return {
        ...item,
        enabled,
      };
    }),
  }));

  return changed
    ? {
        ...state,
        appearanceSections,
      }
    : state;
}

export function updateTradingViewSettingsMockAppearanceItemColor(
  state: ITradingViewChartSettingsValue,
  itemId: string,
  role: ITradingViewSettingsMockColorRole,
  color: string,
): ITradingViewChartSettingsValue {
  let changed = false;
  const colorKey = role === 'up' ? 'upColor' : 'downColor';
  const appearanceSections = state.appearanceSections.map((section) => ({
    ...section,
    items: section.items.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      changed = changed || item[colorKey] !== color;
      return {
        ...item,
        [colorKey]: color,
      };
    }),
  }));

  return changed
    ? {
        ...state,
        appearanceSections,
      }
    : state;
}
