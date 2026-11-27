// cspell:ignore bollinger BRAR KDJ keltner MACD SKDJ Stoch SUPERTREND TRIX VWAP VWMA
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { isTradingViewNativeAnyIndicator } from './utils/chartIndicators';

import type { ITradingViewNativeAnyIndicator } from './utils/chartIndicators';
import type { ITradingViewIndicatorSettingsValue } from '../TradingViewChartControls/chartSettings';

export type IIndicatorSettingsIntl = {
  formatMessage: (descriptor: { id: ETranslations }) => string;
};

// Labels shared by several indicators.
const BACKGROUND_LABEL = ETranslations.market_chart_settings__background;
const LENGTH_LABEL = ETranslations.market_chart_indicator_length__label;
const LONG_LENGTH_LABEL =
  ETranslations.market_chart_indicator_long_length__title;
const LOOKBACK_LABEL = ETranslations.market_chart_indicator_lookback__title;
const LOWER_BAND_LABEL = ETranslations.market_chart_indicator_lower_band__title;
const LOWER_LIMIT_LABEL =
  ETranslations.market_chart_indicator_lower_limit__label;
const MA_LENGTH_LABEL = ETranslations.market_chart_indicator_ma_length__label;
const MULTIPLIER_LABEL = ETranslations.market_chart_indicator_multiplier__title;
const RSI_LENGTH_LABEL = ETranslations.market_chart_indicator_rsi_length__label;
const SHORT_LENGTH_LABEL =
  ETranslations.market_chart_indicator_short_length__title;
const SIGNAL_LABEL = ETranslations.market_chart_indicator_signal__label;
const SIGNAL_LENGTH_LABEL =
  ETranslations.market_chart_indicator_signal_length__label;
const SMOOTHED_MA_LABEL =
  ETranslations.market_chart_indicator_smoothed_ma__label;
const SMOOTHING_LENGTH_LABEL =
  ETranslations.market_chart_indicator_smoothing_length__label;
const UPPER_BAND_LABEL = ETranslations.market_chart_indicator_upper_band__title;
const UPPER_LIMIT_LABEL =
  ETranslations.market_chart_indicator_upper_limit__label;
const ZERO_LABEL = ETranslations.market_chart_indicator_zero__label;

// Full name behind each abbreviation. The record is exhaustive, so an added
// indicator does not compile until it has a localized name.
const INDICATOR_NAMES: Record<ITradingViewNativeAnyIndicator, ETranslations> = {
  MA: ETranslations.market_chart_indicator_ma__title,
  EMA: ETranslations.market_chart_indicator_ema__title,
  WMA: ETranslations.market_chart_indicator_wma__title,
  VWMA: ETranslations.market_chart_indicator_vwma__title,
  BOLL: ETranslations.market_chart_indicator_boll__title,
  SAR: ETranslations.market_chart_indicator_sar__title,
  SUPERTREND: ETranslations.market_chart_indicator_supertrend__title,
  ENV: ETranslations.market_chart_indicator_env__title,
  VWAP: ETranslations.market_chart_indicator_vwap__title,
  DC: ETranslations.market_chart_indicator_dc__title,
  VOL: ETranslations.market_chart_indicator_vol__title,
  // This key holds the full name despite its `__desc` suffix.
  MACD: ETranslations.market_chart_indicator_macd__desc,
  KDJ: ETranslations.market_chart_indicator_kdj__title,
  SKDJ: ETranslations.market_chart_indicator_skdj__title,
  RSI: ETranslations.market_chart_indicator_rsi__title,
  StochRSI: ETranslations.market_chart_indicator_stoch_rsi__title,
  OBV: ETranslations.market_chart_indicator_obv__title,
  MFI: ETranslations.market_chart_indicator_mfi__title,
  DMA: ETranslations.market_chart_indicator_dma__title,
  TRIX: ETranslations.market_chart_indicator_trix__title,
  VR: ETranslations.market_chart_indicator_vr__title,
  BRAR: ETranslations.market_chart_indicator_brar__title,
  EMV: ETranslations.market_chart_indicator_emv__title,
  WR: ETranslations.market_chart_indicator_wr__title,
  ROC: ETranslations.market_chart_indicator_roc__title,
  MTM: ETranslations.market_chart_indicator_mtm__title,
  PSY: ETranslations.market_chart_indicator_psy__title,
  DMI: ETranslations.market_chart_indicator_dmi__title,
  CCI: ETranslations.market_chart_indicator_cci__title,
  PVT: ETranslations.market_chart_indicator_pvt__title,
  ATR: ETranslations.market_chart_indicator_atr__title,
  SMI: ETranslations.market_chart_indicator_smi__title,
  TSI: ETranslations.market_chart_indicator_tsi__title,
  RVI: ETranslations.market_chart_indicator_rvi__title,
  QQE: ETranslations.market_chart_indicator_qqe__title,
  MASS: ETranslations.market_chart_indicator_mass__title,
  KST: ETranslations.market_chart_indicator_kst__title,
  BBP: ETranslations.market_chart_indicator_bbp__title,
  NVI: ETranslations.market_chart_indicator_nvi__title,
  PMO: ETranslations.market_chart_indicator_pmo__title,
  RCI: ETranslations.market_chart_indicator_rci__title,
  SLOPE: ETranslations.market_chart_indicator_slope__title,
};

// Parameter and line labels by setting id. An id without an entry keeps its
// technical name (MA1, DIF, %K, ROC 1), which reads the same in every language.
const INDICATOR_LABELS: Partial<
  Record<
    ITradingViewNativeAnyIndicator,
    Readonly<Record<string, ETranslations>>
  >
> = {
  BOLL: {
    background: BACKGROUND_LABEL,
    deviation: ETranslations.market_chart_indicator_stddev__label,
    period: LENGTH_LABEL,
  },
  SAR: {
    accelerationMax: ETranslations.market_chart_indicator_maximum__label,
    accelerationStart: ETranslations.market_chart_indicator_start__label,
    accelerationStep: ETranslations.market_chart_indicator_increment__label,
  },
  SUPERTREND: {
    atrPeriod: ETranslations.market_chart_indicator_atr_length__title,
    down: ETranslations.market_chart_indicator_down_trend__title,
    multiplier: MULTIPLIER_LABEL,
    up: ETranslations.market_chart_indicator_up_trend__title,
  },
  ENV: {
    background: BACKGROUND_LABEL,
    bandwidth: ETranslations.market_chart_indicator_bandwidth__title,
    lookback: LOOKBACK_LABEL,
    lower: LOWER_BAND_LABEL,
    multiplier: MULTIPLIER_LABEL,
    upper: UPPER_BAND_LABEL,
  },
  VWAP: { period: LENGTH_LABEL },
  DC: {
    background: BACKGROUND_LABEL,
    basis: ETranslations.market_chart_indicator_basis__title,
    lower: LOWER_BAND_LABEL,
    period: LENGTH_LABEL,
    upper: UPPER_BAND_LABEL,
  },
  VOL: {
    movingAveragePeriod: MA_LENGTH_LABEL,
    'plot:movingAverage': ETranslations.market_chart_indicator_volume_ma__label,
    'plot:smoothedMovingAverage': SMOOTHED_MA_LABEL,
    'plot:volume': ETranslations.market_chart_indicator_vol__title,
    smoothingPeriod: SMOOTHING_LENGTH_LABEL,
  },
  MACD: {
    fastPeriod: ETranslations.market_chart_indicator_fast_length__label,
    signalPeriod: SIGNAL_LENGTH_LABEL,
    slowPeriod: ETranslations.market_chart_indicator_slow_length__label,
  },
  KDJ: { period: LENGTH_LABEL },
  SKDJ: { period: LENGTH_LABEL, smoothingPeriod: SMOOTHING_LENGTH_LABEL },
  RSI: {
    'band:lower': LOWER_LIMIT_LABEL,
    'band:middle': ETranslations.market_chart_indicator_middle_limit__label,
    'band:upper': UPPER_LIMIT_LABEL,
    'fill:background': BACKGROUND_LABEL,
    movingAveragePeriod: SMOOTHING_LENGTH_LABEL,
    period: LENGTH_LABEL,
    'plot:movingAverage': SMOOTHED_MA_LABEL,
  },
  StochRSI: {
    'band:lower': LOWER_LIMIT_LABEL,
    'band:upper': UPPER_LIMIT_LABEL,
    'fill:background': BACKGROUND_LABEL,
    rsiPeriod: RSI_LENGTH_LABEL,
    stochasticPeriod:
      ETranslations.market_chart_indicator_stochastic_length__label,
  },
  OBV: { movingAveragePeriod: SMOOTHING_LENGTH_LABEL },
  MFI: {
    'band:lower': LOWER_LIMIT_LABEL,
    'band:upper': UPPER_LIMIT_LABEL,
    'fill:background': BACKGROUND_LABEL,
    period: LENGTH_LABEL,
  },
  DMA: {
    'band:zero': ZERO_LABEL,
    longPeriod: LONG_LENGTH_LABEL,
    movingAveragePeriod: MA_LENGTH_LABEL,
    shortPeriod: SHORT_LENGTH_LABEL,
  },
  TRIX: {
    'band:zero': ZERO_LABEL,
    movingAveragePeriod: MA_LENGTH_LABEL,
    period: LENGTH_LABEL,
  },
  VR: { movingAveragePeriod: MA_LENGTH_LABEL, period: LENGTH_LABEL },
  BRAR: { period: LENGTH_LABEL },
  EMV: {
    divisor: ETranslations.market_chart_indicator_divisor__label,
    movingAveragePeriod: MA_LENGTH_LABEL,
    period: LENGTH_LABEL,
  },
  WR: {
    'band:lower': LOWER_LIMIT_LABEL,
    'band:upper': UPPER_LIMIT_LABEL,
    'fill:background': BACKGROUND_LABEL,
    period: LENGTH_LABEL,
  },
  ROC: {
    'band:zero': ETranslations.market_chart_indicator_zero_line__label,
    movingAveragePeriod: MA_LENGTH_LABEL,
    period: LENGTH_LABEL,
  },
  MTM: {
    'band:zero': ZERO_LABEL,
    movingAveragePeriod: MA_LENGTH_LABEL,
    period: LENGTH_LABEL,
    'plot:momentum': ETranslations.market_chart_indicator_mtm__title,
  },
  PSY: { movingAveragePeriod: MA_LENGTH_LABEL, period: LENGTH_LABEL },
  DMI: {
    adxSmoothingPeriod:
      ETranslations.market_chart_indicator_adx_smoothing__label,
    diPeriod: ETranslations.market_chart_indicator_di_length__label,
  },
  CCI: {
    'band:lower': LOWER_LIMIT_LABEL,
    'band:upper': UPPER_LIMIT_LABEL,
    'fill:background': BACKGROUND_LABEL,
    movingAveragePeriod: SMOOTHING_LENGTH_LABEL,
    period: LENGTH_LABEL,
    'plot:movingAverage': SMOOTHED_MA_LABEL,
  },
  ATR: { period: LENGTH_LABEL },
  SMI: {
    bollingerMultiplier:
      ETranslations.market_chart_indicator_bb_multiplier__title,
    bollingerPeriod: ETranslations.market_chart_indicator_bb_length__title,
    keltnerMultiplier:
      ETranslations.market_chart_indicator_kc_multiplier__title,
    keltnerPeriod: ETranslations.market_chart_indicator_kc_length__title,
    momentumPeriod: ETranslations.market_chart_indicator_momentum_length__title,
  },
  TSI: { 'band:zero': ZERO_LABEL, period: LENGTH_LABEL },
  RVI: {
    period: LENGTH_LABEL,
    'plot:signal': SIGNAL_LABEL,
    signalPeriod: SIGNAL_LENGTH_LABEL,
  },
  QQE: {
    fastFactor: ETranslations.market_chart_indicator_fast_factor__title,
    'plot:fast': ETranslations.market_chart_indicator_fast_line__title,
    'plot:slow': ETranslations.market_chart_indicator_slow_line__title,
    rsiPeriod: RSI_LENGTH_LABEL,
    slowFactor: ETranslations.market_chart_indicator_slow_factor__title,
    smoothingPeriod: SMOOTHING_LENGTH_LABEL,
  },
  MASS: { period: LENGTH_LABEL },
  KST: {
    'band:zero': ZERO_LABEL,
    'plot:signal': SIGNAL_LABEL,
    signalPeriod: SIGNAL_LENGTH_LABEL,
  },
  BBP: { period: LENGTH_LABEL },
  NVI: { movingAveragePeriod: MA_LENGTH_LABEL },
  PMO: {
    'band:zero': ZERO_LABEL,
    firstPeriod: ETranslations.market_chart_indicator_first_length__title,
    'plot:signal': SIGNAL_LABEL,
    secondPeriod: ETranslations.market_chart_indicator_second_length__title,
    signalPeriod: SIGNAL_LENGTH_LABEL,
  },
  RCI: {
    'band:zero': ZERO_LABEL,
    longPeriod: LONG_LENGTH_LABEL,
    middlePeriod: ETranslations.market_chart_indicator_middle_length__title,
    'plot:long': ETranslations.market_chart_indicator_long_line__title,
    'plot:middle': ETranslations.market_chart_indicator_middle_line__title,
    'plot:short': ETranslations.market_chart_indicator_short_line__title,
    shortPeriod: SHORT_LENGTH_LABEL,
  },
  SLOPE: {
    'band:zero': ZERO_LABEL,
    lookback: LOOKBACK_LABEL,
    period: MA_LENGTH_LABEL,
  },
};

// What each indicator measures and how to read it. The record is exhaustive,
// so an added indicator does not compile until it has an explanation.
const INDICATOR_DESCRIPTIONS: Record<
  ITradingViewNativeAnyIndicator,
  ETranslations
> = {
  MA: ETranslations.market_chart_indicator_ma_intro__desc,
  EMA: ETranslations.market_chart_indicator_ema_intro__desc,
  WMA: ETranslations.market_chart_indicator_wma_intro__desc,
  VWMA: ETranslations.market_chart_indicator_vwma_intro__desc,
  BOLL: ETranslations.market_chart_indicator_boll_intro__desc,
  SAR: ETranslations.market_chart_indicator_sar_intro__desc,
  SUPERTREND: ETranslations.market_chart_indicator_supertrend_intro__desc,
  ENV: ETranslations.market_chart_indicator_env_intro__desc,
  VWAP: ETranslations.market_chart_indicator_vwap_intro__desc,
  DC: ETranslations.market_chart_indicator_dc_intro__desc,
  VOL: ETranslations.market_chart_indicator_vol_intro__desc,
  MACD: ETranslations.market_chart_indicator_macd_intro__desc,
  KDJ: ETranslations.market_chart_indicator_kdj_intro__desc,
  SKDJ: ETranslations.market_chart_indicator_skdj_intro__desc,
  RSI: ETranslations.market_chart_indicator_rsi_intro__desc,
  StochRSI: ETranslations.market_chart_indicator_stoch_rsi_intro__desc,
  OBV: ETranslations.market_chart_indicator_obv_intro__desc,
  MFI: ETranslations.market_chart_indicator_mfi_intro__desc,
  DMA: ETranslations.market_chart_indicator_dma_intro__desc,
  TRIX: ETranslations.market_chart_indicator_trix_intro__desc,
  VR: ETranslations.market_chart_indicator_vr_intro__desc,
  BRAR: ETranslations.market_chart_indicator_brar_intro__desc,
  EMV: ETranslations.market_chart_indicator_emv_intro__desc,
  WR: ETranslations.market_chart_indicator_wr_intro__desc,
  ROC: ETranslations.market_chart_indicator_roc_intro__desc,
  MTM: ETranslations.market_chart_indicator_mtm_intro__desc,
  PSY: ETranslations.market_chart_indicator_psy_intro__desc,
  DMI: ETranslations.market_chart_indicator_dmi_intro__desc,
  CCI: ETranslations.market_chart_indicator_cci_intro__desc,
  PVT: ETranslations.market_chart_indicator_pvt_intro__desc,
  ATR: ETranslations.market_chart_indicator_atr_intro__desc,
  SMI: ETranslations.market_chart_indicator_smi_intro__desc,
  TSI: ETranslations.market_chart_indicator_tsi_intro__desc,
  RVI: ETranslations.market_chart_indicator_rvi_intro__desc,
  QQE: ETranslations.market_chart_indicator_qqe_intro__desc,
  MASS: ETranslations.market_chart_indicator_mass_intro__desc,
  KST: ETranslations.market_chart_indicator_kst_intro__desc,
  BBP: ETranslations.market_chart_indicator_bbp_intro__desc,
  NVI: ETranslations.market_chart_indicator_nvi_intro__desc,
  PMO: ETranslations.market_chart_indicator_pmo_intro__desc,
  RCI: ETranslations.market_chart_indicator_rci_intro__desc,
  SLOPE: ETranslations.market_chart_indicator_slope_intro__desc,
};

type ILabelledSettingsItem = {
  id: string;
  label: string;
};

function localizeLabels<T extends ILabelledSettingsItem>(
  items: T[],
  translationIds: Readonly<Record<string, ETranslations>>,
  intl: IIndicatorSettingsIntl,
) {
  return items.map((item) => {
    const translationId = translationIds[item.id];
    return translationId
      ? { ...item, label: intl.formatMessage({ id: translationId }) }
      : item;
  });
}

export function localizeTradingViewNativeIndicatorSettingsValue(
  value: ITradingViewIndicatorSettingsValue,
  intl: IIndicatorSettingsIntl,
): ITradingViewIndicatorSettingsValue {
  return {
    ...value,
    indicators: value.indicators.map((indicator) => {
      if (!isTradingViewNativeAnyIndicator(indicator.id)) {
        return indicator;
      }

      const translatedName = intl.formatMessage({
        id: INDICATOR_NAMES[indicator.id],
      });
      // Some languages keep the indicator's own name (Supertrend), which would
      // only repeat the abbreviation.
      const name =
        translatedName.toLowerCase() === indicator.label.toLowerCase()
          ? undefined
          : translatedName;
      const labels = INDICATOR_LABELS[indicator.id];

      return {
        ...indicator,
        description: intl.formatMessage({
          id: INDICATOR_DESCRIPTIONS[indicator.id],
        }),
        name,
        title: name ? `${indicator.label} (${name})` : indicator.label,
        ...(labels && indicator.parameters
          ? {
              parameters: localizeLabels(indicator.parameters, labels, intl),
            }
          : {}),
        lines: labels
          ? localizeLabels(indicator.lines, labels, intl)
          : indicator.lines,
      };
    }),
  };
}
