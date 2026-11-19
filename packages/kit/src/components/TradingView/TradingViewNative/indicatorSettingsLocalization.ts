// cspell:ignore BRAR KDJ MACD SKDJ Stoch TRIX VWAP
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { isTradingViewNativeAnyIndicator } from './utils/chartIndicators';

import type { ITradingViewNativeAnyIndicator } from './utils/chartIndicators';
import type { ITradingViewIndicatorSettingsValue } from '../TradingViewChartControls/chartSettings';

export type IIndicatorSettingsIntl = {
  formatMessage: (descriptor: { id: ETranslations }) => string;
};

type IIndicatorSettingsTranslationConfig = {
  description?: ETranslations;
  labels?: Readonly<Record<string, ETranslations>>;
  name?: ETranslations;
};

// Labels shared by the indicators that have no name translation yet: they keep
// their English name and only localize the settings that already have a text.
const LENGTH_LABEL = ETranslations.market_chart_indicator_length__label;
const MA_LENGTH_LABEL = ETranslations.market_chart_indicator_ma_length__label;
const SIGNAL_LABEL = ETranslations.market_chart_indicator_signal__label;
const SIGNAL_LENGTH_LABEL =
  ETranslations.market_chart_indicator_signal_length__label;
const SMOOTHING_LENGTH_LABEL =
  ETranslations.market_chart_indicator_smoothing_length__label;
const ZERO_LABEL = ETranslations.market_chart_indicator_zero__label;
const BACKGROUND_LABEL = ETranslations.market_chart_settings__background;

const INDICATOR_SETTINGS_TRANSLATIONS: Partial<
  Record<ITradingViewNativeAnyIndicator, IIndicatorSettingsTranslationConfig>
> = {
  ENV: { labels: { background: BACKGROUND_LABEL } },
  VWAP: { labels: { period: LENGTH_LABEL } },
  DC: { labels: { background: BACKGROUND_LABEL, period: LENGTH_LABEL } },
  KDJ: { labels: { period: LENGTH_LABEL } },
  SKDJ: {
    labels: { period: LENGTH_LABEL, smoothingPeriod: SMOOTHING_LENGTH_LABEL },
  },
  DMA: {
    labels: { 'band:zero': ZERO_LABEL, movingAveragePeriod: MA_LENGTH_LABEL },
  },
  VR: {
    labels: { movingAveragePeriod: MA_LENGTH_LABEL, period: LENGTH_LABEL },
  },
  BRAR: { labels: { period: LENGTH_LABEL } },
  PSY: {
    labels: { movingAveragePeriod: MA_LENGTH_LABEL, period: LENGTH_LABEL },
  },
  ATR: { labels: { period: LENGTH_LABEL } },
  TSI: { labels: { 'band:zero': ZERO_LABEL, period: LENGTH_LABEL } },
  RVI: {
    labels: {
      period: LENGTH_LABEL,
      'plot:signal': SIGNAL_LABEL,
      signalPeriod: SIGNAL_LENGTH_LABEL,
    },
  },
  QQE: {
    labels: {
      rsiPeriod: ETranslations.market_chart_indicator_rsi_length__label,
      smoothingPeriod: SMOOTHING_LENGTH_LABEL,
    },
  },
  MASS: { labels: { period: LENGTH_LABEL } },
  KST: {
    labels: {
      'band:zero': ZERO_LABEL,
      'plot:signal': SIGNAL_LABEL,
      signalPeriod: SIGNAL_LENGTH_LABEL,
    },
  },
  BBP: { labels: { period: LENGTH_LABEL } },
  NVI: { labels: { movingAveragePeriod: MA_LENGTH_LABEL } },
  PMO: {
    labels: {
      'band:zero': ZERO_LABEL,
      'plot:signal': SIGNAL_LABEL,
      signalPeriod: SIGNAL_LENGTH_LABEL,
    },
  },
  RCI: { labels: { 'band:zero': ZERO_LABEL } },
  SLOPE: { labels: { 'band:zero': ZERO_LABEL, period: MA_LENGTH_LABEL } },
  BOLL: {
    labels: {
      background: ETranslations.market_chart_settings__background,
      deviation: ETranslations.market_chart_indicator_stddev__label,
      period: ETranslations.market_chart_indicator_length__label,
    },
  },
  SAR: {
    labels: {
      accelerationMax: ETranslations.market_chart_indicator_maximum__label,
      accelerationStart: ETranslations.market_chart_indicator_start__label,
      accelerationStep: ETranslations.market_chart_indicator_increment__label,
    },
  },
  VOL: {
    labels: {
      movingAveragePeriod:
        ETranslations.market_chart_indicator_ma_length__label,
      'plot:movingAverage':
        ETranslations.market_chart_indicator_volume_ma__label,
      'plot:smoothedMovingAverage':
        ETranslations.market_chart_indicator_smoothed_ma__label,
      'plot:volume': ETranslations.market_chart_indicator_vol__title,
      smoothingPeriod:
        ETranslations.market_chart_indicator_smoothing_length__label,
    },
    name: ETranslations.market_chart_indicator_vol__title,
  },
  MACD: {
    description: ETranslations.market_chart_indicator_macd__desc,
    labels: {
      fastPeriod: ETranslations.market_chart_indicator_fast_length__label,
      signalPeriod: ETranslations.market_chart_indicator_signal_length__label,
      slowPeriod: ETranslations.market_chart_indicator_slow_length__label,
    },
  },
  RSI: {
    labels: {
      'band:lower': ETranslations.market_chart_indicator_lower_limit__label,
      'band:middle': ETranslations.market_chart_indicator_middle_limit__label,
      'band:upper': ETranslations.market_chart_indicator_upper_limit__label,
      'fill:background': ETranslations.market_chart_settings__background,
      movingAveragePeriod:
        ETranslations.market_chart_indicator_smoothing_length__label,
      period: ETranslations.market_chart_indicator_length__label,
      'plot:movingAverage':
        ETranslations.market_chart_indicator_smoothed_ma__label,
    },
    name: ETranslations.market_chart_indicator_rsi__title,
  },
  StochRSI: {
    labels: {
      'band:lower': ETranslations.market_chart_indicator_lower_limit__label,
      'band:upper': ETranslations.market_chart_indicator_upper_limit__label,
      'fill:background': ETranslations.market_chart_settings__background,
      rsiPeriod: ETranslations.market_chart_indicator_rsi_length__label,
      stochasticPeriod:
        ETranslations.market_chart_indicator_stochastic_length__label,
    },
    name: ETranslations.market_chart_indicator_stoch_rsi__title,
  },
  OBV: {
    labels: {
      movingAveragePeriod:
        ETranslations.market_chart_indicator_smoothing_length__label,
    },
    name: ETranslations.market_chart_indicator_obv__title,
  },
  MFI: {
    labels: {
      'band:lower': ETranslations.market_chart_indicator_lower_limit__label,
      'band:upper': ETranslations.market_chart_indicator_upper_limit__label,
      'fill:background': ETranslations.market_chart_settings__background,
      period: ETranslations.market_chart_indicator_length__label,
    },
    name: ETranslations.market_chart_indicator_mfi__title,
  },
  TRIX: {
    labels: {
      'band:zero': ETranslations.market_chart_indicator_zero__label,
      period: ETranslations.market_chart_indicator_length__label,
    },
  },
  EMV: {
    labels: {
      divisor: ETranslations.market_chart_indicator_divisor__label,
      period: ETranslations.market_chart_indicator_length__label,
    },
    name: ETranslations.market_chart_indicator_emv__title,
  },
  WR: {
    labels: {
      'band:lower': ETranslations.market_chart_indicator_lower_limit__label,
      'band:upper': ETranslations.market_chart_indicator_upper_limit__label,
      'fill:background': ETranslations.market_chart_settings__background,
      period: ETranslations.market_chart_indicator_length__label,
    },
    name: ETranslations.market_chart_indicator_wr__title,
  },
  ROC: {
    labels: {
      'band:zero': ETranslations.market_chart_indicator_zero_line__label,
      period: ETranslations.market_chart_indicator_length__label,
    },
    name: ETranslations.market_chart_indicator_roc__title,
  },
  MTM: {
    labels: {
      'band:zero': ETranslations.market_chart_indicator_zero__label,
      period: ETranslations.market_chart_indicator_length__label,
      'plot:momentum': ETranslations.market_chart_indicator_mtm__title,
    },
    name: ETranslations.market_chart_indicator_mtm__title,
  },
  DMI: {
    labels: {
      adxSmoothingPeriod:
        ETranslations.market_chart_indicator_adx_smoothing__label,
      diPeriod: ETranslations.market_chart_indicator_di_length__label,
    },
    name: ETranslations.market_chart_indicator_dmi__title,
  },
  CCI: {
    labels: {
      'band:lower': ETranslations.market_chart_indicator_lower_limit__label,
      'band:upper': ETranslations.market_chart_indicator_upper_limit__label,
      'fill:background': ETranslations.market_chart_settings__background,
      movingAveragePeriod:
        ETranslations.market_chart_indicator_smoothing_length__label,
      period: ETranslations.market_chart_indicator_length__label,
      'plot:movingAverage':
        ETranslations.market_chart_indicator_smoothed_ma__label,
    },
    name: ETranslations.market_chart_indicator_cci__title,
  },
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

      const translationConfig = INDICATOR_SETTINGS_TRANSLATIONS[indicator.id];
      if (!translationConfig) {
        return indicator;
      }

      const descriptionId =
        translationConfig.description ?? translationConfig.name;
      const translatedName = translationConfig.name
        ? intl.formatMessage({ id: translationConfig.name })
        : undefined;
      const labels = translationConfig.labels;

      return {
        ...indicator,
        ...(descriptionId
          ? { description: intl.formatMessage({ id: descriptionId }) }
          : {}),
        ...(translatedName
          ? { title: `${indicator.label} (${translatedName})` }
          : {}),
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
