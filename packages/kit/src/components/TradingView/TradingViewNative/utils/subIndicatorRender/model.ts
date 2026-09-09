import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getTradingViewNativeSubIndicatorDefinition } from './definitions';

import type {
  ITradingViewNativeSubIndicatorBandStyle,
  ITradingViewNativeSubIndicatorCalculation,
  ITradingViewNativeSubIndicatorFillStyle,
  ITradingViewNativeSubIndicatorPaletteDefinition,
  ITradingViewNativeSubIndicatorPlotStyle,
  ITradingViewNativeSubIndicatorRenderPalette,
  ITradingViewNativeSubIndicatorRenderPane,
  ITradingViewNativeSubIndicatorResolvedInstance,
  ITradingViewNativeSubIndicatorScale,
} from './types';
import type { ITradingViewNativeIndicatorValues } from '../chartIndicators';

function createRenderKey(
  instanceId: string,
  kind: 'band' | 'fill' | 'pane' | 'plot',
  id?: string,
) {
  const baseKey = `subIndicator.${instanceId}.${kind}`;
  return id === undefined ? baseKey : `${baseKey}.${id}`;
}

function normalizePointCount(pointCount: number) {
  return Number.isFinite(pointCount) ? Math.max(0, Math.floor(pointCount)) : 0;
}

function normalizeValues(
  values: readonly (number | null | undefined)[] | undefined,
  pointCount: number,
): ITradingViewNativeIndicatorValues {
  if (values?.length === pointCount) {
    return values as ITradingViewNativeIndicatorValues;
  }
  const normalizedValues: ITradingViewNativeIndicatorValues =
    Array(pointCount).fill(null);

  if (!values) {
    return normalizedValues;
  }

  const copyLength = Math.min(values.length, pointCount);
  for (let index = 0; index < copyLength; index += 1) {
    const value = values[index];
    normalizedValues[index] =
      typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  return normalizedValues;
}

function normalizePaletteIndexes(
  indexes: readonly (number | null | undefined)[] | undefined,
  colorCount: number,
  pointCount: number,
): Array<number | null> {
  if (indexes?.length === pointCount) {
    return indexes as Array<number | null>;
  }
  const normalizedIndexes: Array<number | null> = Array(pointCount).fill(null);

  if (!indexes || colorCount === 0) {
    return normalizedIndexes;
  }

  const copyLength = Math.min(indexes.length, pointCount);
  for (let index = 0; index < copyLength; index += 1) {
    const paletteIndex = indexes[index];
    normalizedIndexes[index] =
      typeof paletteIndex === 'number' &&
      Number.isInteger(paletteIndex) &&
      paletteIndex >= 0 &&
      paletteIndex < colorCount
        ? paletteIndex
        : null;
  }

  return normalizedIndexes;
}

function clonePlotStyle(
  style: ITradingViewNativeSubIndicatorPlotStyle,
): ITradingViewNativeSubIndicatorPlotStyle {
  return { ...style };
}

function cloneBandStyle(
  style: ITradingViewNativeSubIndicatorBandStyle,
): ITradingViewNativeSubIndicatorBandStyle {
  return { ...style };
}

function cloneFillStyle(
  style: ITradingViewNativeSubIndicatorFillStyle,
): ITradingViewNativeSubIndicatorFillStyle {
  return { ...style };
}

function cloneScale(
  scale: ITradingViewNativeSubIndicatorScale,
): ITradingViewNativeSubIndicatorScale {
  if (scale.kind === 'fixed') {
    return { ...scale };
  }

  return {
    ...scale,
    includeValues: [...scale.includeValues],
    padding: { ...scale.padding },
  };
}

function buildRenderPalette({
  calculation,
  paletteDefinition,
  paletteColors,
  pointCount,
}: {
  calculation: ITradingViewNativeSubIndicatorCalculation;
  paletteColors: readonly string[] | undefined;
  paletteDefinition: ITradingViewNativeSubIndicatorPaletteDefinition;
  pointCount: number;
}): ITradingViewNativeSubIndicatorRenderPalette {
  const colors = paletteColors ? [...paletteColors] : [];

  return {
    colors,
    indexes: normalizePaletteIndexes(
      calculation.paletteIndexes[paletteDefinition.id],
      colors.length,
      pointCount,
    ),
  };
}

export function buildTradingViewNativeSubIndicatorRenderPane({
  calculation,
  instance,
}: {
  calculation: ITradingViewNativeSubIndicatorCalculation;
  instance: ITradingViewNativeSubIndicatorResolvedInstance;
}): ITradingViewNativeSubIndicatorRenderPane {
  if (calculation.indicator !== instance.indicator) {
    throw new OneKeyLocalError(
      `Cannot build ${instance.indicator} render pane from ${calculation.indicator} calculation`,
    );
  }

  const definition = getTradingViewNativeSubIndicatorDefinition(
    instance.indicator,
  );
  const pointCount = normalizePointCount(calculation.pointCount);
  const paletteDefinitions = new Map(
    definition.palettes.map((palette) => [palette.id, palette]),
  );

  return {
    bands: definition.bands.map((band) => ({
      id: band.id,
      key: createRenderKey(instance.id, 'band', band.id),
      style: cloneBandStyle(
        instance.settings.bands[band.id] ?? band.defaultStyle,
      ),
      title: band.title,
      zOrder: band.zOrder,
    })),
    fills: definition.fills.map((fill) => ({
      fromId: fill.fromId,
      id: fill.id,
      key: createRenderKey(instance.id, 'fill', fill.id),
      style: cloneFillStyle(
        instance.settings.fills[fill.id] ?? fill.defaultStyle,
      ),
      title: fill.title,
      toId: fill.toId,
      type: fill.type,
      zOrder: fill.zOrder,
    })),
    format: { ...definition.format },
    indicator: instance.indicator,
    inputValues: { ...calculation.inputValues },
    instanceId: instance.id,
    isVisible: instance.isVisible,
    key: createRenderKey(instance.id, 'pane'),
    scale: cloneScale(instance.settings.scale),
    series: definition.plots.map((plot) => {
      const paletteDefinition = plot.paletteId
        ? paletteDefinitions.get(plot.paletteId)
        : undefined;
      const palette = paletteDefinition
        ? buildRenderPalette({
            calculation,
            paletteColors: instance.settings.palettes[paletteDefinition.id],
            paletteDefinition,
            pointCount,
          })
        : undefined;

      return {
        id: plot.id,
        key: createRenderKey(instance.id, 'plot', plot.id),
        ...(palette ? { palette } : {}),
        style: clonePlotStyle(
          instance.settings.plots[plot.id] ?? plot.defaultStyle,
        ),
        title: plot.title,
        values: normalizeValues(calculation.plots[plot.id], pointCount),
        zOrder: plot.zOrder,
      };
    }),
    shortTitle: definition.shortTitle,
    title: definition.title,
  };
}

export function buildTradingViewNativeSubIndicatorRenderPanes(
  entries: readonly {
    calculation: ITradingViewNativeSubIndicatorCalculation;
    instance: ITradingViewNativeSubIndicatorResolvedInstance;
  }[],
): ITradingViewNativeSubIndicatorRenderPane[] {
  return entries.map(buildTradingViewNativeSubIndicatorRenderPane);
}
