// cspell:ignore donchian macd MAEMV MAMTM MAROC supertrend trix
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { createTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsAdapter';
import { localizeTradingViewNativeIndicatorSettingsValue } from './indicatorSettingsLocalization';
import { TRADING_VIEW_NATIVE_ALL_INDICATORS } from './utils/chartIndicators';

import type { IIndicatorSettingsIntl } from './indicatorSettingsLocalization';

const EXPECTED_TRANSLATION_IDS = [
  ETranslations.market_chart_indicator_adx_smoothing__label,
  ETranslations.market_chart_indicator_cci__title,
  ETranslations.market_chart_indicator_di_length__label,
  ETranslations.market_chart_indicator_divisor__label,
  ETranslations.market_chart_indicator_dmi__title,
  ETranslations.market_chart_indicator_emv__title,
  ETranslations.market_chart_indicator_fast_length__label,
  ETranslations.market_chart_indicator_increment__label,
  ETranslations.market_chart_indicator_length__label,
  ETranslations.market_chart_indicator_lower_limit__label,
  ETranslations.market_chart_indicator_ma_length__label,
  ETranslations.market_chart_indicator_macd__desc,
  ETranslations.market_chart_indicator_maximum__label,
  ETranslations.market_chart_indicator_mfi__title,
  ETranslations.market_chart_indicator_middle_limit__label,
  ETranslations.market_chart_indicator_mtm__title,
  ETranslations.market_chart_indicator_obv__title,
  ETranslations.market_chart_indicator_roc__title,
  ETranslations.market_chart_indicator_rsi__title,
  ETranslations.market_chart_indicator_rsi_length__label,
  ETranslations.market_chart_indicator_signal_length__label,
  ETranslations.market_chart_indicator_slow_length__label,
  ETranslations.market_chart_indicator_smoothed_ma__label,
  ETranslations.market_chart_indicator_smoothing_length__label,
  ETranslations.market_chart_indicator_start__label,
  ETranslations.market_chart_indicator_stddev__label,
  ETranslations.market_chart_indicator_stoch_rsi__title,
  ETranslations.market_chart_indicator_stochastic_length__label,
  ETranslations.market_chart_indicator_upper_limit__label,
  ETranslations.market_chart_indicator_vol__title,
  ETranslations.market_chart_indicator_volume_ma__label,
  ETranslations.market_chart_indicator_wr__title,
  ETranslations.market_chart_indicator_zero__label,
  ETranslations.market_chart_indicator_zero_line__label,
  ETranslations.market_chart_settings__background,
  ETranslations.market_chart_indicator_atr_length__title,
  ETranslations.market_chart_indicator_bandwidth__title,
  ETranslations.market_chart_indicator_basis__title,
  ETranslations.market_chart_indicator_bb_length__title,
  ETranslations.market_chart_indicator_bb_multiplier__title,
  ETranslations.market_chart_indicator_down_trend__title,
  ETranslations.market_chart_indicator_fast_factor__title,
  ETranslations.market_chart_indicator_fast_line__title,
  ETranslations.market_chart_indicator_first_length__title,
  ETranslations.market_chart_indicator_kc_length__title,
  ETranslations.market_chart_indicator_kc_multiplier__title,
  ETranslations.market_chart_indicator_long_length__title,
  ETranslations.market_chart_indicator_long_line__title,
  ETranslations.market_chart_indicator_lookback__title,
  ETranslations.market_chart_indicator_lower_band__title,
  ETranslations.market_chart_indicator_middle_length__title,
  ETranslations.market_chart_indicator_middle_line__title,
  ETranslations.market_chart_indicator_momentum_length__title,
  ETranslations.market_chart_indicator_multiplier__title,
  ETranslations.market_chart_indicator_second_length__title,
  ETranslations.market_chart_indicator_short_length__title,
  ETranslations.market_chart_indicator_short_line__title,
  ETranslations.market_chart_indicator_slow_factor__title,
  ETranslations.market_chart_indicator_slow_line__title,
  ETranslations.market_chart_indicator_up_trend__title,
  ETranslations.market_chart_indicator_upper_band__title,
] as const;

const TRANSLATION_IDS = new Set<string>(Object.values(ETranslations));

// Line and series names such as MA1, DIF, %K, +DI or KST's ROC 1 read the same
// in every language.
const TECHNICAL_LABEL_PATTERN = /^(?:[%+-]?[A-Z]+\d*|[A-Z]+ \d)$/;

function getLocalizedValue(
  formatMessage: IIndicatorSettingsIntl['formatMessage'] = ({ id }) => id,
) {
  return localizeTradingViewNativeIndicatorSettingsValue(
    createTradingViewNativeIndicatorSettingsValue(),
    { formatMessage },
  );
}

describe('indicatorSettingsLocalization', () => {
  it('uses every existing production indicator-settings translation', () => {
    const value = getLocalizedValue();
    const renderedTexts = new Set(
      value.indicators.flatMap((indicator) => [
        indicator.description,
        indicator.name,
        indicator.title,
        ...(indicator.parameters?.map((parameter) => parameter.label) ?? []),
        ...indicator.lines.map((line) => line.label),
      ]),
    );

    expect(
      EXPECTED_TRANSLATION_IDS.filter(
        (translationId) => !renderedTexts.has(translationId),
      ),
    ).toEqual([]);
  });

  it('keeps technical identifiers while localizing user-facing names', () => {
    const value = getLocalizedValue();
    const volume = value.indicators.find((indicator) => indicator.id === 'VOL');
    const macd = value.indicators.find((indicator) => indicator.id === 'MACD');
    const obv = value.indicators.find((indicator) => indicator.id === 'OBV');
    const rsi = value.indicators.find((indicator) => indicator.id === 'RSI');
    const trix = value.indicators.find((indicator) => indicator.id === 'TRIX');

    expect(volume).toMatchObject({
      label: 'VOL',
      name: ETranslations.market_chart_indicator_vol__title,
      title: `VOL (${ETranslations.market_chart_indicator_vol__title})`,
    });
    expect(macd).toMatchObject({
      label: 'MACD',
      name: ETranslations.market_chart_indicator_macd__desc,
      title: `MACD (${ETranslations.market_chart_indicator_macd__desc})`,
    });
    expect(macd?.lines.map((line) => line.label)).toEqual([
      'DIF',
      'DEA',
      'MACD',
    ]);
    expect(
      obv?.lines.find((line) => line.id === 'plot:movingAverage'),
    ).toMatchObject({ enabled: true, label: 'MAOBV' });
    expect(rsi).toMatchObject({
      label: 'RSI',
      name: ETranslations.market_chart_indicator_rsi__title,
      title: `RSI (${ETranslations.market_chart_indicator_rsi__title})`,
    });
    expect(trix).toMatchObject({
      label: 'TRIX',
      name: ETranslations.market_chart_indicator_trix__title,
      title: `TRIX (${ETranslations.market_chart_indicator_trix__title})`,
    });
  });

  it('names every indicator after its abbreviation with its own localized name', () => {
    const value = getLocalizedValue();
    const names = value.indicators.map((indicator) => indicator.name);

    expect(names).toHaveLength(TRADING_VIEW_NATIVE_ALL_INDICATORS.length);
    expect(names.every((name) => name && TRANSLATION_IDS.has(name))).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    for (const indicator of value.indicators) {
      expect(indicator.title).toBe(`${indicator.label} (${indicator.name})`);
    }

    const nameOf = (id: string) =>
      value.indicators.find((indicator) => indicator.id === id)?.name;
    expect(nameOf('MA')).toBe(ETranslations.market_chart_indicator_ma__title);
    expect(nameOf('SUPERTREND')).toBe(
      ETranslations.market_chart_indicator_supertrend__title,
    );
    expect(nameOf('WMA')).toBe(ETranslations.market_chart_indicator_wma__title);
    expect(nameOf('KDJ')).toBe(ETranslations.market_chart_indicator_kdj__title);
    expect(nameOf('SLOPE')).toBe(
      ETranslations.market_chart_indicator_slope__title,
    );
  });

  it('keeps only the abbreviation when the localized name repeats it', () => {
    const value = getLocalizedValue(({ id }) =>
      id === ETranslations.market_chart_indicator_supertrend__title
        ? 'Supertrend'
        : id,
    );
    const supertrend = value.indicators.find(
      (indicator) => indicator.id === 'SUPERTREND',
    );
    const kst = value.indicators.find((indicator) => indicator.id === 'KST');

    expect(supertrend?.title).toBe('SUPERTREND');
    expect(supertrend?.name).toBeUndefined();
    expect(kst).toMatchObject({
      name: ETranslations.market_chart_indicator_kst__title,
      title: `KST (${ETranslations.market_chart_indicator_kst__title})`,
    });
  });

  it('translates every settings label that is not a technical name', () => {
    const value = getLocalizedValue();
    const englishLabels = value.indicators.flatMap((indicator) =>
      [...(indicator.parameters ?? []), ...indicator.lines]
        .map((item) => item.label)
        .filter(
          (label) =>
            !TRANSLATION_IDS.has(label) && !TECHNICAL_LABEL_PATTERN.test(label),
        )
        .map((label) => `${indicator.id}: ${label}`),
    );

    expect(englishLabels).toEqual([]);
  });

  it('keeps the moving average line names and localizes their length', () => {
    const value = getLocalizedValue();
    const lineNames = {
      EMV: 'MAEMV',
      MTM: 'MAMTM',
      ROC: 'MAROC',
      TRIX: 'MATRIX',
    };

    for (const [id, label] of Object.entries(lineNames)) {
      const indicator = value.indicators.find((item) => item.id === id);

      expect(
        indicator?.lines.find((line) => line.id === 'plot:movingAverage'),
      ).toMatchObject({ enabled: true, label });
      expect(
        indicator?.parameters?.find(
          (parameter) => parameter.id === 'movingAveragePeriod',
        )?.label,
      ).toBe(ETranslations.market_chart_indicator_ma_length__label);
    }
  });

  it('localizes the settings of the added indicators and keeps their technical names', () => {
    const value = getLocalizedValue();
    const find = (id: string) =>
      value.indicators.find((indicator) => indicator.id === id);
    const labelsOf = (items: { label: string }[] | undefined) =>
      items?.map((item) => item.label);

    expect(find('KDJ')).toMatchObject({
      label: 'KDJ',
      title: `KDJ (${ETranslations.market_chart_indicator_kdj__title})`,
    });
    expect(labelsOf(find('KDJ')?.parameters)).toEqual([
      ETranslations.market_chart_indicator_length__label,
      'K',
      'D',
    ]);
    expect(labelsOf(find('PMO')?.parameters)).toEqual([
      ETranslations.market_chart_indicator_first_length__title,
      ETranslations.market_chart_indicator_second_length__title,
      ETranslations.market_chart_indicator_signal_length__label,
      ETranslations.market_chart_indicator_zero__label,
    ]);
    expect(labelsOf(find('PMO')?.lines)).toEqual([
      'PMO',
      ETranslations.market_chart_indicator_signal__label,
      ETranslations.market_chart_indicator_zero__label,
    ]);
    expect(find('DC')?.title).toBe(
      `DC (${ETranslations.market_chart_indicator_dc__title})`,
    );
    expect(labelsOf(find('DC')?.lines)).toEqual([
      ETranslations.market_chart_indicator_basis__title,
      ETranslations.market_chart_indicator_upper_band__title,
      ETranslations.market_chart_indicator_lower_band__title,
      ETranslations.market_chart_settings__background,
    ]);
    expect(labelsOf(find('SUPERTREND')?.lines)).toEqual([
      ETranslations.market_chart_indicator_up_trend__title,
      ETranslations.market_chart_indicator_down_trend__title,
    ]);
    expect(labelsOf(find('RCI')?.lines)).toEqual([
      ETranslations.market_chart_indicator_short_line__title,
      ETranslations.market_chart_indicator_middle_line__title,
      ETranslations.market_chart_indicator_long_line__title,
      ETranslations.market_chart_indicator_zero__label,
    ]);
    expect(labelsOf(find('KST')?.parameters)?.slice(0, 2)).toEqual([
      'ROC 1',
      'ROC 2',
    ]);
  });

  it('explains every indicator with its own text', () => {
    const value = getLocalizedValue();
    const descriptions = value.indicators.map(
      (indicator) => indicator.description,
    );

    expect(descriptions).toHaveLength(
      TRADING_VIEW_NATIVE_ALL_INDICATORS.length,
    );
    expect(descriptions.every(Boolean)).toBe(true);
    expect(new Set(descriptions).size).toBe(descriptions.length);

    const descriptionOf = (id: string) =>
      value.indicators.find((indicator) => indicator.id === id)?.description;
    expect(descriptionOf('MA')).toBe(
      ETranslations.market_chart_indicator_ma_intro__desc,
    );
    expect(descriptionOf('StochRSI')).toBe(
      ETranslations.market_chart_indicator_stoch_rsi_intro__desc,
    );
    // MACD's older `__desc` key is its full name, not this explanation.
    expect(descriptionOf('MACD')).toBe(
      ETranslations.market_chart_indicator_macd_intro__desc,
    );
  });

  it('keeps background, zero, and zero-line labels distinct', () => {
    const value = getLocalizedValue();
    const boll = value.indicators.find((indicator) => indicator.id === 'BOLL');
    const rsi = value.indicators.find((indicator) => indicator.id === 'RSI');
    const trix = value.indicators.find((indicator) => indicator.id === 'TRIX');
    const roc = value.indicators.find((indicator) => indicator.id === 'ROC');

    expect(boll?.lines.find((line) => line.id === 'background')?.label).toBe(
      ETranslations.market_chart_settings__background,
    );
    expect(
      rsi?.lines.find((line) => line.id === 'fill:background')?.label,
    ).toBe(ETranslations.market_chart_settings__background);
    expect(trix?.lines.find((line) => line.id === 'band:zero')?.label).toBe(
      ETranslations.market_chart_indicator_zero__label,
    );
    expect(roc?.lines.find((line) => line.id === 'band:zero')?.label).toBe(
      ETranslations.market_chart_indicator_zero_line__label,
    );
  });
});
