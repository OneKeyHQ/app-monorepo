import {
  resolveTradingViewNativeSubIndicatorInstance,
  resolveTradingViewNativeSubIndicatorSettings,
} from './settings';

import type {
  ITradingViewNativeSubIndicatorDefinition,
  ITradingViewNativeSubIndicatorSettingsOverrides,
} from './types';

const TEST_DEFINITION = {
  bands: [
    {
      defaultStyle: {
        color: '#787B86',
        lineStyle: 'dashed',
        lineWidth: 1,
        transparency: 10,
        value: 70,
        visible: true,
      },
      id: 'upper',
      title: 'Upper',
      zOrder: -10,
    },
  ],
  description: 'Test indicator',
  fills: [
    {
      defaultStyle: {
        color: '#7E57C2',
        transparency: 90,
        visible: true,
      },
      fromId: 'upper',
      id: 'background',
      title: 'Background',
      toId: 'lower',
      type: 'band-band',
      zOrder: -20,
    },
  ],
  format: { precision: 2, type: 'price' },
  indicator: 'RSI',
  inputs: [
    {
      defaultValue: 14,
      id: 'length',
      max: 100,
      min: 1,
      title: 'Length',
      type: 'integer',
    },
    {
      defaultValue: 1.5,
      id: 'multiplier',
      max: 2,
      min: 0,
      step: 0.1,
      title: 'Multiplier',
      type: 'float',
    },
    {
      defaultValue: true,
      id: 'enabled',
      title: 'Enabled',
      type: 'boolean',
    },
    {
      defaultValue: 'fast',
      id: 'mode',
      options: ['fast', 'slow'],
      title: 'Mode',
      type: 'select',
    },
    {
      defaultValue: 'close',
      id: 'source',
      options: ['close', 'hl2'],
      title: 'Source',
      type: 'source',
    },
  ],
  palettes: [
    {
      defaultColors: ['#26A69A', '#EF5350'],
      id: 'direction',
      title: 'Direction',
    },
  ],
  plots: [
    {
      defaultStyle: {
        baseline: 0,
        color: '#2196F3',
        joinPoints: false,
        lineStyle: 'solid',
        lineWidth: 1,
        transparency: 0,
        type: 'line',
        visible: true,
      },
      id: 'main',
      paletteId: 'direction',
      title: 'Main',
      zOrder: 10,
    },
  ],
  scale: {
    includeValues: [0],
    kind: 'auto',
    padding: { bottomRatio: 0.1, topRatio: 0.1 },
  },
  shortTitle: 'Test',
  title: 'Test Indicator',
} satisfies ITradingViewNativeSubIndicatorDefinition;

describe('TradingViewNative sub-indicator settings', () => {
  it('resolves definition defaults into independent mutable values', () => {
    const settings =
      resolveTradingViewNativeSubIndicatorSettings(TEST_DEFINITION);

    expect(settings.inputs).toEqual({
      enabled: true,
      length: 14,
      mode: 'fast',
      multiplier: 1.5,
      source: 'close',
    });
    expect(settings.plots.main).toEqual(TEST_DEFINITION.plots[0]?.defaultStyle);
    expect(settings.bands.upper).toEqual(
      TEST_DEFINITION.bands[0]?.defaultStyle,
    );
    expect(settings.fills.background).toEqual(
      TEST_DEFINITION.fills[0]?.defaultStyle,
    );
    expect(settings.palettes.direction).toEqual(['#26A69A', '#EF5350']);
    expect(settings.scale).toEqual(TEST_DEFINITION.scale);
    expect(settings.plots.main).not.toBe(
      TEST_DEFINITION.plots[0]?.defaultStyle,
    );
    expect(settings.bands.upper).not.toBe(
      TEST_DEFINITION.bands[0]?.defaultStyle,
    );
    expect(settings.fills.background).not.toBe(
      TEST_DEFINITION.fills[0]?.defaultStyle,
    );
    expect(settings.palettes.direction).not.toBe(
      TEST_DEFINITION.palettes[0]?.defaultColors,
    );
    expect(settings.scale).not.toBe(TEST_DEFINITION.scale);
    if (settings.scale.kind === 'auto') {
      expect(settings.scale.includeValues).not.toBe(
        TEST_DEFINITION.scale.includeValues,
      );
      expect(settings.scale.padding).not.toBe(TEST_DEFINITION.scale.padding);
    }
  });

  it('normalizes each input according to its schema', () => {
    const overrides = {
      inputs: {
        enabled: false,
        length: 3.6,
        mode: 'slow',
        multiplier: -1,
        source: 'invalid-source',
        unknown: 99,
      },
    } as unknown as ITradingViewNativeSubIndicatorSettingsOverrides;

    const settings = resolveTradingViewNativeSubIndicatorSettings(
      TEST_DEFINITION,
      overrides,
    );

    expect(settings.inputs).toEqual({
      enabled: false,
      length: 4,
      mode: 'slow',
      multiplier: 0,
      source: 'close',
    });

    const invalidSettings = resolveTradingViewNativeSubIndicatorSettings(
      TEST_DEFINITION,
      {
        inputs: {
          enabled: 'true',
          length: Number.NaN,
          mode: 'invalid-mode',
          multiplier: Number.POSITIVE_INFINITY,
          source: 'hl2',
        },
      },
    );
    expect(invalidSettings.inputs).toEqual({
      enabled: true,
      length: 14,
      mode: 'fast',
      multiplier: 1.5,
      source: 'hl2',
    });

    const clampedSettings = resolveTradingViewNativeSubIndicatorSettings(
      TEST_DEFINITION,
      { inputs: { length: 100.8, multiplier: 3 } },
    );
    expect(clampedSettings.inputs.length).toBe(100);
    expect(clampedSettings.inputs.multiplier).toBe(2);
  });

  it('normalizes style, palette, and auto-scale overrides safely', () => {
    const overrides = {
      bands: {
        upper: {
          color: '#FF0000',
          lineStyle: 'invalid',
          lineWidth: Number.NaN,
          transparency: -10,
          value: Number.POSITIVE_INFINITY,
          visible: false,
        },
        unknown: { visible: false },
      },
      fills: {
        background: {
          color: '   ',
          transparency: 110,
          visible: false,
        },
        unknown: { visible: false },
      },
      palettes: {
        direction: [' #111111 ', '', 42, '#222222'],
        unknown: ['#000000'],
      },
      plots: {
        main: {
          baseline: 5,
          color: ' #FFFFFF ',
          joinPoints: true,
          lineStyle: 'dotted',
          lineWidth: -2,
          transparency: 120,
          type: 'histogram',
          visible: false,
        },
        unknown: { visible: false },
      },
      scale: {
        includeValues: [0, 20, Number.NaN, 'invalid'],
        kind: 'auto',
        padding: {
          bottomRatio: -1,
          topRatio: Number.POSITIVE_INFINITY,
        },
      },
    } as unknown as ITradingViewNativeSubIndicatorSettingsOverrides;

    const settings = resolveTradingViewNativeSubIndicatorSettings(
      TEST_DEFINITION,
      overrides,
    );

    expect(settings.plots).toEqual({
      main: {
        baseline: 5,
        color: '#FFFFFF',
        joinPoints: true,
        lineStyle: 'dotted',
        lineWidth: 0,
        transparency: 100,
        type: 'histogram',
        visible: false,
      },
    });
    expect(settings.bands).toEqual({
      upper: {
        color: '#FF0000',
        lineStyle: 'dashed',
        lineWidth: 1,
        transparency: 0,
        value: 70,
        visible: false,
      },
    });
    expect(settings.fills).toEqual({
      background: {
        color: '#7E57C2',
        transparency: 100,
        visible: false,
      },
    });
    expect(settings.palettes).toEqual({
      direction: ['#111111', '#EF5350'],
    });
    expect(settings.palettes.direction).toHaveLength(
      TEST_DEFINITION.palettes[0].defaultColors.length,
    );
    expect(settings.scale).toEqual({
      includeValues: [0, 20],
      kind: 'auto',
      padding: { bottomRatio: 0, topRatio: 0.1 },
    });
  });

  it('accepts valid fixed scales and rejects invalid fixed ranges', () => {
    const fixedSettings = resolveTradingViewNativeSubIndicatorSettings(
      TEST_DEFINITION,
      { scale: { kind: 'fixed', maxValue: 100, minValue: -100 } },
    );
    expect(fixedSettings.scale).toEqual({
      kind: 'fixed',
      maxValue: 100,
      minValue: -100,
    });

    const invalidSettings = resolveTradingViewNativeSubIndicatorSettings(
      TEST_DEFINITION,
      {
        scale: { kind: 'fixed', maxValue: 0, minValue: 10 },
      },
    );
    expect(invalidSettings.scale).toEqual(TEST_DEFINITION.scale);
    expect(invalidSettings.scale).not.toBe(TEST_DEFINITION.scale);
  });

  it('resolves an instance against its registered indicator definition', () => {
    const instance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'rsi-1',
      indicator: 'RSI',
      isVisible: false,
      settings: {
        inputs: { period: 9999 },
        plots: { movingAverage: { visible: true } },
      },
    });

    expect(instance.id).toBe('rsi-1');
    expect(instance.indicator).toBe('RSI');
    expect(instance.isVisible).toBe(false);
    expect(instance.settings.inputs.period).toBe(2000);
    expect(instance.settings.inputs.movingAveragePeriod).toBe(14);
    expect(instance.settings.plots.movingAverage?.visible).toBe(true);

    const defaultInstance = resolveTradingViewNativeSubIndicatorInstance({
      id: 'mfi-1',
      indicator: 'MFI',
    });
    expect(defaultInstance.isVisible).toBe(true);
  });
});
