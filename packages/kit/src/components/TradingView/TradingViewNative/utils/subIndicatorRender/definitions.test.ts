// cspell:ignore ADXR MACD StochRSI TRIX autoscale
import { TRADING_VIEW_NATIVE_SUB_INDICATORS } from '../chartIndicators';

import {
  TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS,
  getTradingViewNativeSubIndicatorDefinition,
} from './definitions';
import { resolveTradingViewNativeSubIndicatorSettings } from './settings';

import type {
  ITradingViewNativeSubIndicatorDefinition,
  ITradingViewNativeSubIndicatorInputDefinition,
} from './types';

const PLOT_TYPES = ['columns', 'histogram', 'line'] as const;
const LINE_STYLES = ['dashed', 'dotted', 'solid'] as const;

function expectUniqueIds(items: readonly { id: string }[]): void {
  const ids = items.map(({ id }) => id);

  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => id.trim().length > 0)).toBe(true);
}

function expectInputDefaultToBeValid(
  input: ITradingViewNativeSubIndicatorInputDefinition,
): void {
  switch (input.type) {
    case 'boolean':
      expect(typeof input.defaultValue).toBe('boolean');
      break;
    case 'float':
    case 'integer':
      expect(Number.isFinite(input.min)).toBe(true);
      expect(Number.isFinite(input.max)).toBe(true);
      expect(Number.isFinite(input.defaultValue)).toBe(true);
      expect(input.min).toBeLessThanOrEqual(input.max);
      expect(input.defaultValue).toBeGreaterThanOrEqual(input.min);
      expect(input.defaultValue).toBeLessThanOrEqual(input.max);
      if (input.type === 'integer') {
        expect(Number.isInteger(input.defaultValue)).toBe(true);
      }
      if (input.step !== undefined) {
        expect(Number.isFinite(input.step)).toBe(true);
        expect(input.step).toBeGreaterThan(0);
      }
      break;
    case 'select':
    case 'source':
      expect(input.options.length).toBeGreaterThan(0);
      expect(new Set(input.options).size).toBe(input.options.length);
      expect(input.options).toContain(input.defaultValue);
      break;
    default: {
      const exhaustiveInput: never = input;
      expect(exhaustiveInput).toBeUndefined();
    }
  }
}

function expectFiniteStyleDefaults(
  definition: ITradingViewNativeSubIndicatorDefinition,
): void {
  for (const plot of definition.plots) {
    const style = plot.defaultStyle;

    expect(Number.isFinite(plot.zOrder)).toBe(true);
    expect(Number.isFinite(style.baseline)).toBe(true);
    expect(Number.isFinite(style.lineWidth)).toBe(true);
    expect(Number.isFinite(style.transparency)).toBe(true);
    expect(style.color.trim().length).toBeGreaterThan(0);
    expect(style.lineWidth).toBeGreaterThanOrEqual(0);
    expect(style.transparency).toBeGreaterThanOrEqual(0);
    expect(style.transparency).toBeLessThanOrEqual(100);
    expect(LINE_STYLES).toContain(style.lineStyle);
    expect(PLOT_TYPES).toContain(style.type);
    expect(typeof style.joinPoints).toBe('boolean');
    expect(typeof style.visible).toBe('boolean');
  }

  for (const band of definition.bands) {
    const style = band.defaultStyle;

    expect(Number.isFinite(band.zOrder)).toBe(true);
    expect(Number.isFinite(style.lineWidth)).toBe(true);
    expect(Number.isFinite(style.transparency)).toBe(true);
    expect(Number.isFinite(style.value)).toBe(true);
    expect(style.color.trim().length).toBeGreaterThan(0);
    expect(style.lineWidth).toBeGreaterThanOrEqual(0);
    expect(style.transparency).toBeGreaterThanOrEqual(0);
    expect(style.transparency).toBeLessThanOrEqual(100);
    expect(LINE_STYLES).toContain(style.lineStyle);
    expect(typeof style.visible).toBe('boolean');
  }

  for (const fill of definition.fills) {
    const style = fill.defaultStyle;

    expect(Number.isFinite(fill.zOrder)).toBe(true);
    expect(Number.isFinite(style.transparency)).toBe(true);
    expect(style.color.trim().length).toBeGreaterThan(0);
    expect(style.transparency).toBeGreaterThanOrEqual(0);
    expect(style.transparency).toBeLessThanOrEqual(100);
    expect(typeof style.visible).toBe('boolean');
  }

  for (const palette of definition.palettes) {
    expect(palette.defaultColors.length).toBeGreaterThan(0);
    expect(
      palette.defaultColors.every((color) => color.trim().length > 0),
    ).toBe(true);
  }

  if (definition.format.precision !== undefined) {
    expect(Number.isInteger(definition.format.precision)).toBe(true);
    expect(definition.format.precision).toBeGreaterThanOrEqual(0);
  }

  if (definition.scale.kind === 'fixed') {
    expect(Number.isFinite(definition.scale.minValue)).toBe(true);
    expect(Number.isFinite(definition.scale.maxValue)).toBe(true);
    expect(definition.scale.maxValue).toBeGreaterThan(
      definition.scale.minValue,
    );
  } else {
    expect(definition.scale.includeValues.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(definition.scale.padding.bottomRatio)).toBe(true);
    expect(Number.isFinite(definition.scale.padding.topRatio)).toBe(true);
    expect(definition.scale.padding.bottomRatio).toBeGreaterThanOrEqual(0);
    expect(definition.scale.padding.topRatio).toBeGreaterThanOrEqual(0);
  }
}

describe('TradingViewNative sub-indicator definitions', () => {
  it('is exhaustive and preserves the controller indicator order', () => {
    const definitionIndicators =
      TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS.map(
        ({ indicator }) => indicator,
      );

    expect(definitionIndicators).toEqual(TRADING_VIEW_NATIVE_SUB_INDICATORS);
    expect(TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS).toHaveLength(13);
    expect(new Set(definitionIndicators).size).toBe(
      TRADING_VIEW_NATIVE_SUB_INDICATORS.length,
    );

    TRADING_VIEW_NATIVE_SUB_INDICATORS.forEach((indicator, index) => {
      expect(getTradingViewNativeSubIndicatorDefinition(indicator)).toBe(
        TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS[index],
      );
    });
  });

  it('uses unique IDs and valid references within every definition', () => {
    for (const definition of TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS) {
      expectUniqueIds(definition.inputs);
      expectUniqueIds(definition.plots);
      expectUniqueIds(definition.palettes);
      expectUniqueIds(definition.bands);
      expectUniqueIds(definition.fills);

      const plotIds = new Set(definition.plots.map(({ id }) => id));
      const paletteIds = new Set(definition.palettes.map(({ id }) => id));
      const bandIds = new Set(definition.bands.map(({ id }) => id));

      for (const input of definition.inputs) {
        for (const plotId of input.visibleWhenPlotIds ?? []) {
          expect(plotIds.has(plotId)).toBe(true);
        }
      }

      for (const plot of definition.plots) {
        if (plot.paletteId !== undefined) {
          expect(paletteIds.has(plot.paletteId)).toBe(true);
        }
      }

      for (const fill of definition.fills) {
        expect(fill.fromId).not.toBe(fill.toId);
        const referencedIds = fill.type === 'band-band' ? bandIds : plotIds;
        expect(referencedIds.has(fill.fromId)).toBe(true);
        expect(referencedIds.has(fill.toId)).toBe(true);
      }
    }
  });

  it('keeps all input defaults, styles, formats, and scales valid', () => {
    for (const definition of TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS) {
      definition.inputs.forEach(expectInputDefaultToBeValid);
      expectFiniteStyleDefaults(definition);
    }
  });

  it('models the Volume and MACD palette-backed column plots', () => {
    const volume = getTradingViewNativeSubIndicatorDefinition('VOL');
    expect(volume.plots.map(({ id }) => id)).toEqual([
      'volume',
      'movingAverage',
      'smoothedMovingAverage',
    ]);
    expect(volume.plots[0]).toMatchObject({
      defaultStyle: { transparency: 50, type: 'columns' },
      paletteId: 'volume',
    });
    expect(volume.palettes).toHaveLength(1);
    expect(volume.palettes[0]).toMatchObject({
      id: 'volume',
      defaultColors: expect.any(Array),
    });
    expect(volume.palettes[0]?.defaultColors).toHaveLength(2);

    const macd = getTradingViewNativeSubIndicatorDefinition('MACD');
    expect(macd.plots.map(({ id }) => id)).toEqual([
      'macd',
      'signal',
      'histogram',
    ]);
    expect(macd.plots.map(({ title }) => title)).toEqual([
      'DIF',
      'DEA',
      'MACD',
    ]);
    expect(macd.plots[2]).toMatchObject({
      defaultStyle: { baseline: 0, type: 'columns' },
      paletteId: 'histogram',
    });
    expect(macd.palettes).toHaveLength(1);
    expect(macd.palettes[0]?.id).toBe('histogram');
    expect(macd.palettes[0]?.defaultColors).toHaveLength(4);
  });

  it('enables the 30-period MAOBV line by default', () => {
    const obv = getTradingViewNativeSubIndicatorDefinition('OBV');

    expect(
      obv.inputs.find(({ id }) => id === 'movingAveragePeriod'),
    ).toMatchObject({ defaultValue: 30 });
    expect(obv.plots.map(({ title }) => title)).toEqual(['OBV', 'MAOBV']);
    expect(obv.plots[1]).toMatchObject({
      defaultStyle: {
        color: '$orange9',
        visible: true,
      },
    });
  });

  it('models oscillator bands, fills, and zero reference lines', () => {
    const filledOscillators = {
      CCI: [100, -100],
      MFI: [80, 20],
      RSI: [70, 50, 30],
      StochRSI: [80, 20],
      WR: [-20, -80],
    } as const;

    for (const [indicator, values] of Object.entries(filledOscillators)) {
      const definition = getTradingViewNativeSubIndicatorDefinition(
        indicator as keyof typeof filledOscillators,
      );
      expect(
        definition.bands.map(({ defaultStyle }) => defaultStyle.value),
      ).toEqual(values);
      expect(definition.fills).toHaveLength(1);
      expect(definition.fills[0]).toMatchObject({
        fromId: 'upper',
        toId: 'lower',
        type: 'band-band',
      });
    }

    for (const indicator of ['TRIX', 'ROC', 'MTM'] as const) {
      const definition = getTradingViewNativeSubIndicatorDefinition(indicator);
      expect(definition.bands).toHaveLength(1);
      expect(definition.bands[0]).toMatchObject({
        defaultStyle: { value: 0, visible: true },
        id: 'zero',
      });
      expect(definition.fills).toEqual([]);
    }
  });

  it('preserves the five DMI output plots in bundle order', () => {
    const dmi = getTradingViewNativeSubIndicatorDefinition('DMI');

    expect(dmi.plots.map(({ id }) => id)).toEqual([
      'plusDi',
      'minusDi',
      'dx',
      'adx',
      'adxr',
    ]);
    expect(dmi.plots.map(({ title }) => title)).toEqual([
      '+DI',
      '-DI',
      'DX',
      'ADX',
      'ADXR',
    ]);
  });

  it('uses auto scale for all 13 definitions', () => {
    expect(
      TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS.every(
        ({ scale }) => scale.kind === 'auto',
      ),
    ).toBe(true);
  });

  it('resolves every definition into independent settings', () => {
    for (const definition of TRADING_VIEW_NATIVE_SUB_INDICATOR_DEFINITIONS) {
      const first = resolveTradingViewNativeSubIndicatorSettings(definition);
      const second = resolveTradingViewNativeSubIndicatorSettings(definition);

      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.inputs).not.toBe(second.inputs);
      expect(first.plots).not.toBe(second.plots);
      expect(first.bands).not.toBe(second.bands);
      expect(first.fills).not.toBe(second.fills);
      expect(first.palettes).not.toBe(second.palettes);
      expect(Object.keys(first.inputs)).toEqual(
        definition.inputs.map(({ id }) => id),
      );
      expect(Object.keys(first.plots)).toEqual(
        definition.plots.map(({ id }) => id),
      );
      expect(Object.keys(first.bands)).toEqual(
        definition.bands.map(({ id }) => id),
      );
      expect(Object.keys(first.fills)).toEqual(
        definition.fills.map(({ id }) => id),
      );
      expect(Object.keys(first.palettes)).toEqual(
        definition.palettes.map(({ id }) => id),
      );

      for (const plot of definition.plots) {
        expect(first.plots[plot.id]).not.toBe(plot.defaultStyle);
        expect(first.plots[plot.id]).not.toBe(second.plots[plot.id]);
      }
      for (const band of definition.bands) {
        expect(first.bands[band.id]).not.toBe(band.defaultStyle);
        expect(first.bands[band.id]).not.toBe(second.bands[band.id]);
      }
      for (const fill of definition.fills) {
        expect(first.fills[fill.id]).not.toBe(fill.defaultStyle);
        expect(first.fills[fill.id]).not.toBe(second.fills[fill.id]);
      }
      for (const palette of definition.palettes) {
        expect(first.palettes[palette.id]).not.toBe(palette.defaultColors);
        expect(first.palettes[palette.id]).not.toBe(
          second.palettes[palette.id],
        );
      }

      expect(first.scale).not.toBe(definition.scale);
      expect(first.scale).not.toBe(second.scale);
      if (first.scale.kind === 'auto' && second.scale.kind === 'auto') {
        expect(first.scale.includeValues).not.toBe(second.scale.includeValues);
        expect(first.scale.padding).not.toBe(second.scale.padding);
      }
    }
  });
});
