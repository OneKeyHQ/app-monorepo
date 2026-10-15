import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  createTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeIndicatorSettings,
} from './indicatorSettingsAdapter';
import {
  applyMobileIndicatorNumberDrafts,
  createMobileIndicatorNumberDrafts,
  getMobileIndicatorLineNumberField,
  getMobileIndicatorNumberFields,
  mergeMobileIndicatorSettings,
  normalizeMobileIndicatorNumber,
} from './mobileIndicatorSettingsUtils';

import type { IMobileIndicatorNumberField } from './mobileIndicatorSettingsUtils';

describe('mobile indicator numeric drafts', () => {
  const value = createTradingViewNativeIndicatorSettingsValue();

  it('keeps all 17 indicators and their persisted options intact on an unchanged save', () => {
    expect(value.indicators).toHaveLength(17);
    const next = {
      ...value,
      indicators: value.indicators.map((indicator) =>
        applyMobileIndicatorNumberDrafts(
          indicator,
          createMobileIndicatorNumberDrafts(indicator),
        ),
      ),
    };
    expect(getTradingViewNativeIndicatorSettings(next)).toEqual(
      getTradingViewNativeIndicatorSettings(value),
    );
  });

  it.each(
    value.indicators.map((indicator) => [indicator.id, indicator] as const),
  )(
    '%s exposes each numeric setting exactly once, including paired bands and moving averages',
    (_id, indicator) => {
      const fields = getMobileIndicatorNumberFields(indicator);
      const paired = indicator.lines.flatMap((line) => {
        const field = getMobileIndicatorLineNumberField(line, fields);
        return field ? [field.key] : [];
      });
      const unpaired = fields
        .filter((field) => !paired.includes(field.key))
        .map((field) => field.key);
      const displayed = [...paired, ...unpaired];
      expect(new Set(displayed).size).toBe(displayed.length);
      expect(displayed.toSorted()).toEqual(
        fields.map((field) => field.key).toSorted(),
      );
      expect(
        fields
          .filter((field) => field.target === 'parameter')
          .map((field) => field.id),
      ).toEqual(indicator.parameters?.map((parameter) => parameter.id) ?? []);
    },
  );

  const field: IMobileIndicatorNumberField = {
    key: 'parameter:period',
    id: 'period',
    target: 'parameter',
    label: 'Period',
    value: 14,
    min: 1,
    max: 100,
    step: 1,
  };
  it.each([
    ['', 14],
    ['-', 14],
    ['NaN', 14],
    ['Infinity', 14],
    ['0x10', 14],
    ['0', 1],
    ['101', 100],
    ['17.6', 18],
    [' 21 ', 21],
  ])(
    'normalizes %s to %s without persisting invalid values',
    (text, expected) => {
      expect(normalizeMobileIndicatorNumber(String(text), field)).toBe(
        expected,
      );
    },
  );

  it('preserves signed thresholds and fractional SAR steps without floating point drift', () => {
    expect(
      normalizeMobileIndicatorNumber('-100', { ...field, min: -Infinity }),
    ).toBe(-100);
    expect(
      normalizeMobileIndicatorNumber('0.03', { ...field, min: 0, step: 0.01 }),
    ).toBe(0.03);
    expect(
      normalizeMobileIndicatorNumber(String(0.2 + 0.1), {
        ...field,
        min: 0,
        step: 0.1,
      }),
    ).toBe(0.3);
  });

  it.each([70.5, -80.25])(
    'preserves the fractional threshold %s without an explicit step',
    (threshold) => {
      expect(
        normalizeMobileIndicatorNumber(String(threshold), {
          ...field,
          min: -Infinity,
          step: undefined,
        }),
      ).toBe(threshold);
    },
  );
});

describe('mergeMobileIndicatorSettings', () => {
  it('saves only the edited indicator and preserves concurrent selection and settings', () => {
    const current = getTradingViewNativeIndicatorSettings(
      createTradingViewNativeIndicatorSettingsValue(),
    );
    const draft = getTradingViewNativeIndicatorSettings(
      createTradingViewNativeIndicatorSettingsValue(),
    );
    const currentBoll = current.mainIndicators.find(({ id }) => id === 'BOLL');
    const draftBoll = draft.mainIndicators.find(({ id }) => id === 'BOLL');
    const currentRsi = current.subIndicators.find(({ id }) => id === 'RSI');
    if (!currentBoll || !draftBoll || !currentRsi) {
      throw new OneKeyLocalError(
        'Expected BOLL and RSI in the indicator catalog',
      );
    }
    currentBoll.active = true;
    currentRsi.active = true;
    currentRsi.parameters.period = 28;
    draftBoll.parameters.period = 30;
    draftBoll.lines.middle.color = '#123456';

    const result = mergeMobileIndicatorSettings(current, draft, 'BOLL');

    expect(result.mainIndicators.find(({ id }) => id === 'BOLL')).toEqual({
      ...draftBoll,
      active: true,
    });
    expect(result.subIndicators).toEqual(current.subIndicators);
    expect(result.mainIndicators.filter(({ id }) => id !== 'BOLL')).toEqual(
      current.mainIndicators.filter(({ id }) => id !== 'BOLL'),
    );
    expect(currentBoll.parameters.period).toBe(20);
  });

  it('adds a setting to empty storage without enabling the indicator', () => {
    const next = getTradingViewNativeIndicatorSettings(
      createTradingViewNativeIndicatorSettingsValue(),
    );
    const result = mergeMobileIndicatorSettings(
      {
        schemaVersion: next.schemaVersion,
        mainIndicators: [],
        subIndicators: [],
      },
      next,
      'RSI',
    );
    expect(result.mainIndicators).toEqual([]);
    expect(result.subIndicators).toEqual([
      expect.objectContaining({ id: 'RSI', active: false }),
    ]);
  });
});
