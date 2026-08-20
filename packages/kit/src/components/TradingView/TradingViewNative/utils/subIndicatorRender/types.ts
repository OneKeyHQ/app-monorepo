import type {
  ITradingViewNativeIndicatorValues,
  ITradingViewNativeSubIndicator,
} from '../chartIndicators';

export type ITradingViewNativeSubIndicatorInputValue =
  | boolean
  | number
  | string;

interface ITradingViewNativeSubIndicatorInputDefinitionBase {
  id: string;
  title: string;
  visibleWhenPlotIds?: readonly string[];
}

export interface ITradingViewNativeSubIndicatorNumberInputDefinition extends ITradingViewNativeSubIndicatorInputDefinitionBase {
  defaultValue: number;
  max: number;
  min: number;
  step?: number;
  type: 'float' | 'integer';
}

export interface ITradingViewNativeSubIndicatorBooleanInputDefinition extends ITradingViewNativeSubIndicatorInputDefinitionBase {
  defaultValue: boolean;
  type: 'boolean';
}

export interface ITradingViewNativeSubIndicatorChoiceInputDefinition extends ITradingViewNativeSubIndicatorInputDefinitionBase {
  defaultValue: string;
  options: readonly string[];
  type: 'select' | 'source';
}

export type ITradingViewNativeSubIndicatorInputDefinition =
  | ITradingViewNativeSubIndicatorBooleanInputDefinition
  | ITradingViewNativeSubIndicatorChoiceInputDefinition
  | ITradingViewNativeSubIndicatorNumberInputDefinition;

export type ITradingViewNativeSubIndicatorPlotType =
  | 'columns'
  | 'histogram'
  | 'line';

export type ITradingViewNativeSubIndicatorLineStyle =
  | 'dashed'
  | 'dotted'
  | 'solid';

export interface ITradingViewNativeSubIndicatorPlotStyle {
  baseline: number;
  color: string;
  joinPoints: boolean;
  lineStyle: ITradingViewNativeSubIndicatorLineStyle;
  lineWidth: number;
  transparency: number;
  type: ITradingViewNativeSubIndicatorPlotType;
  visible: boolean;
}

export interface ITradingViewNativeSubIndicatorBandStyle {
  color: string;
  lineStyle: ITradingViewNativeSubIndicatorLineStyle;
  lineWidth: number;
  transparency: number;
  value: number;
  visible: boolean;
}

export interface ITradingViewNativeSubIndicatorFillStyle {
  color: string;
  transparency: number;
  visible: boolean;
}

export interface ITradingViewNativeSubIndicatorPlotDefinition {
  defaultStyle: ITradingViewNativeSubIndicatorPlotStyle;
  id: string;
  paletteId?: string;
  title: string;
  zOrder: number;
}

export interface ITradingViewNativeSubIndicatorPaletteDefinition {
  defaultColors: readonly string[];
  id: string;
  title: string;
}

export interface ITradingViewNativeSubIndicatorBandDefinition {
  defaultStyle: ITradingViewNativeSubIndicatorBandStyle;
  id: string;
  title: string;
  zOrder: number;
}

export interface ITradingViewNativeSubIndicatorFillDefinition {
  defaultStyle: ITradingViewNativeSubIndicatorFillStyle;
  fromId: string;
  id: string;
  title: string;
  toId: string;
  type: 'band-band' | 'plot-plot';
  zOrder: number;
}

export interface ITradingViewNativeSubIndicatorAutoScale {
  includeValues: readonly number[];
  kind: 'auto';
  padding: {
    bottomRatio: number;
    topRatio: number;
  };
}

export interface ITradingViewNativeSubIndicatorFixedScale {
  kind: 'fixed';
  maxValue: number;
  minValue: number;
}

export type ITradingViewNativeSubIndicatorScale =
  | ITradingViewNativeSubIndicatorAutoScale
  | ITradingViewNativeSubIndicatorFixedScale;

export interface ITradingViewNativeSubIndicatorFormat {
  precision?: number;
  type: 'inherit' | 'price' | 'volume';
}

export interface ITradingViewNativeSubIndicatorDefinition {
  bands: readonly ITradingViewNativeSubIndicatorBandDefinition[];
  description: string;
  fills: readonly ITradingViewNativeSubIndicatorFillDefinition[];
  format: ITradingViewNativeSubIndicatorFormat;
  indicator: ITradingViewNativeSubIndicator;
  inputs: readonly ITradingViewNativeSubIndicatorInputDefinition[];
  palettes: readonly ITradingViewNativeSubIndicatorPaletteDefinition[];
  plots: readonly ITradingViewNativeSubIndicatorPlotDefinition[];
  scale: ITradingViewNativeSubIndicatorScale;
  shortTitle: string;
  title: string;
}

export interface ITradingViewNativeSubIndicatorSettingsOverrides {
  bands?: Readonly<
    Record<string, Partial<ITradingViewNativeSubIndicatorBandStyle>>
  >;
  fills?: Readonly<
    Record<string, Partial<ITradingViewNativeSubIndicatorFillStyle>>
  >;
  inputs?: Readonly<Record<string, ITradingViewNativeSubIndicatorInputValue>>;
  palettes?: Readonly<Record<string, readonly string[]>>;
  plots?: Readonly<
    Record<string, Partial<ITradingViewNativeSubIndicatorPlotStyle>>
  >;
  scale?: ITradingViewNativeSubIndicatorScale;
}

export interface ITradingViewNativeSubIndicatorResolvedSettings {
  bands: Record<string, ITradingViewNativeSubIndicatorBandStyle>;
  fills: Record<string, ITradingViewNativeSubIndicatorFillStyle>;
  inputs: Record<string, ITradingViewNativeSubIndicatorInputValue>;
  palettes: Record<string, string[]>;
  plots: Record<string, ITradingViewNativeSubIndicatorPlotStyle>;
  scale: ITradingViewNativeSubIndicatorScale;
}

export interface ITradingViewNativeSubIndicatorInstanceConfig {
  id: string;
  indicator: ITradingViewNativeSubIndicator;
  isVisible?: boolean;
  settings?: ITradingViewNativeSubIndicatorSettingsOverrides;
}

export interface ITradingViewNativeSubIndicatorResolvedInstance {
  id: string;
  indicator: ITradingViewNativeSubIndicator;
  isVisible: boolean;
  settings: ITradingViewNativeSubIndicatorResolvedSettings;
}

export interface ITradingViewNativeSubIndicatorCalculation {
  indicator: ITradingViewNativeSubIndicator;
  inputValues: Record<string, ITradingViewNativeSubIndicatorInputValue>;
  paletteIndexes: Record<string, Array<number | null>>;
  plots: Record<string, ITradingViewNativeIndicatorValues>;
  pointCount: number;
}

export interface ITradingViewNativeSubIndicatorRenderPalette {
  colors: string[];
  indexes: Array<number | null>;
}

export interface ITradingViewNativeSubIndicatorRenderSeries {
  id: string;
  key: string;
  palette?: ITradingViewNativeSubIndicatorRenderPalette;
  style: ITradingViewNativeSubIndicatorPlotStyle;
  title: string;
  values: ITradingViewNativeIndicatorValues;
  zOrder: number;
}

export interface ITradingViewNativeSubIndicatorRenderBand {
  id: string;
  key: string;
  style: ITradingViewNativeSubIndicatorBandStyle;
  title: string;
  zOrder: number;
}

export interface ITradingViewNativeSubIndicatorRenderFill {
  fromId: string;
  id: string;
  key: string;
  style: ITradingViewNativeSubIndicatorFillStyle;
  title: string;
  toId: string;
  type: ITradingViewNativeSubIndicatorFillDefinition['type'];
  zOrder: number;
}

export interface ITradingViewNativeSubIndicatorRenderPane {
  bands: ITradingViewNativeSubIndicatorRenderBand[];
  fills: ITradingViewNativeSubIndicatorRenderFill[];
  format: ITradingViewNativeSubIndicatorFormat;
  indicator: ITradingViewNativeSubIndicator;
  inputValues: Record<string, ITradingViewNativeSubIndicatorInputValue>;
  instanceId: string;
  isVisible: boolean;
  key: string;
  scale: ITradingViewNativeSubIndicatorScale;
  series: ITradingViewNativeSubIndicatorRenderSeries[];
  shortTitle: string;
  title: string;
}

export interface ITradingViewNativeSubIndicatorValueRange {
  maxValue: number;
  minValue: number;
}
