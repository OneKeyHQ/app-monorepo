// cspell:ignore donchian macd trix
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
] as const;

function getLocalizedValue() {
  const intl: IIndicatorSettingsIntl = {
    formatMessage: ({ id }) => id,
  };
  return localizeTradingViewNativeIndicatorSettingsValue(
    createTradingViewNativeIndicatorSettingsValue(),
    intl,
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
    // MACD's title has no English name to replace, so it stays the abbreviation.
    expect(macd).toMatchObject({
      label: 'MACD',
      name: ETranslations.market_chart_indicator_macd__desc,
      title: 'MACD',
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
      name: 'TRIX',
      title: 'TRIX',
    });
  });

  it('keeps the English name of an added indicator and localizes its shared labels', () => {
    const value = getLocalizedValue();
    const kdj = value.indicators.find((indicator) => indicator.id === 'KDJ');
    const pmo = value.indicators.find((indicator) => indicator.id === 'PMO');
    const donchian = value.indicators.find(
      (indicator) => indicator.id === 'DC',
    );

    expect(kdj).toMatchObject({
      label: 'KDJ',
      name: 'Stochastic Oscillator',
      title: 'KDJ (Stochastic Oscillator)',
    });
    expect(kdj?.parameters?.map((parameter) => parameter.label)).toEqual([
      ETranslations.market_chart_indicator_length__label,
      'K',
      'D',
    ]);
    expect(pmo?.lines.map((line) => line.label)).toEqual([
      'PMO',
      ETranslations.market_chart_indicator_signal__label,
      ETranslations.market_chart_indicator_zero__label,
    ]);
    expect(donchian).toMatchObject({ title: 'DC (Donchian Channels)' });
    expect(donchian?.lines.at(-1)?.label).toBe(
      ETranslations.market_chart_settings__background,
    );
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
