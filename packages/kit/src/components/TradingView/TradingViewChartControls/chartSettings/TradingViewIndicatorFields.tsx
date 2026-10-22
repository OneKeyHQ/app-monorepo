import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  NumberInput,
  SegmentSlider,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  SettingsCheckboxRow,
  SettingsColorField,
  SettingsColorPicker,
  SettingsLineStylePreview,
  SettingsRow,
  SettingsSelect,
} from './TradingViewSettingsPrimitives';

import type {
  ITradingViewSettingsMockColorRole,
  ITradingViewSettingsMockLine,
  ITradingViewSettingsMockLineStyle,
  ITradingViewSettingsMockNumberParam,
} from './TradingViewSettingsMockState';

const TRADING_VIEW_INDICATOR_NUMBER_INPUT_WIDTH = 128;
const TRADING_VIEW_INDICATOR_LINE_STYLE_OPTIONS = [
  { value: 'solid-1', style: 'solid', pattern: 'solid', width: 1 },
  { value: 'solid-2', style: 'medium', pattern: 'solid', width: 2 },
  { value: 'solid-3', style: 'bold', pattern: 'solid', width: 3 },
  { value: 'solid-4', style: 'extraBold', pattern: 'solid', width: 4 },
  { value: 'dashed-1', style: 'solid', pattern: 'dashed', width: 1 },
  { value: 'dashed-2', style: 'medium', pattern: 'dashed', width: 2 },
  { value: 'dashed-3', style: 'bold', pattern: 'dashed', width: 3 },
  { value: 'dashed-4', style: 'extraBold', pattern: 'dashed', width: 4 },
] as const satisfies readonly {
  value: string;
  style: ITradingViewSettingsMockLineStyle;
  pattern: 'solid' | 'dashed';
  width: number;
}[];
const TRADING_VIEW_INDICATOR_OPACITY_SEGMENTS = 4;

function TradingViewIndicatorNumberInput({
  value,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  width = TRADING_VIEW_INDICATOR_NUMBER_INPUT_WIDTH,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  onChange: (value: number) => void;
}) {
  const valueRef = useRef(value);
  const [inputValue, setInputValue] = useState(() => String(value));

  useEffect(() => {
    valueRef.current = value;
    setInputValue(String(value));
  }, [value]);

  const getDecimalPrecision = useCallback((numberValue: number) => {
    const stringValue = String(numberValue);
    const exponentSeparatorIndex = stringValue.indexOf('e-');
    if (exponentSeparatorIndex >= 0) {
      return Number(stringValue.slice(exponentSeparatorIndex + 2));
    }

    const decimalSeparatorIndex = stringValue.indexOf('.');
    return decimalSeparatorIndex >= 0
      ? stringValue.length - decimalSeparatorIndex - 1
      : 0;
  }, []);

  const normalizeValue = useCallback(
    (text: string, fallbackValue: number) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return fallbackValue;
      }

      const parsedValue = Number(trimmedText.replace(/,/g, ''));
      if (!Number.isFinite(parsedValue)) {
        return fallbackValue;
      }

      const boundedValue = Math.min(max, Math.max(min, parsedValue));
      if (!Number.isFinite(step) || step <= 0) {
        return boundedValue;
      }

      const stepBase = Number.isFinite(min) ? min : 0;
      const precision = Math.min(
        12,
        Math.max(getDecimalPrecision(step), getDecimalPrecision(stepBase)),
      );
      const steppedValue =
        stepBase + Math.round((boundedValue - stepBase) / step) * step;
      return Math.min(
        max,
        Math.max(min, Number(steppedValue.toFixed(precision))),
      );
    },
    [getDecimalPrecision, max, min, step],
  );

  const commitInputValue = useCallback(() => {
    const previousValue = valueRef.current;
    const nextValue = normalizeValue(inputValue, previousValue);
    valueRef.current = nextValue;
    setInputValue(String(nextValue));
    if (nextValue !== previousValue) {
      onChange(nextValue);
    }
  }, [inputValue, normalizeValue, onChange]);

  const stepInputValue = useCallback(
    (direction: -1 | 1) => {
      const effectiveStep = Number.isFinite(step) && step > 0 ? step : 1;
      const previousValue = valueRef.current;
      const currentValue = normalizeValue(inputValue, previousValue);
      const nextValue = normalizeValue(
        String(currentValue + direction * effectiveStep),
        currentValue,
      );
      valueRef.current = nextValue;
      setInputValue(String(nextValue));
      if (nextValue !== previousValue) {
        onChange(nextValue);
      }
    },
    [inputValue, normalizeValue, onChange, step],
  );

  return (
    <NumberInput
      testID="trading-view-indicator-number-input"
      size="small"
      containerProps={{ w: width }}
      value={inputValue}
      keyboardType="decimal-pad"
      returnKeyType="done"
      selectTextOnFocus
      autoCorrect={false}
      showControls
      onStep={stepInputValue}
      onChangeText={setInputValue}
      onBlur={commitInputValue}
      onSubmitEditing={commitInputValue}
    />
  );
}

export function TradingViewIndicatorParameterRow({
  parameters,
  onChange,
}: {
  parameters: ITradingViewSettingsMockNumberParam[];
  onChange: (parameterId: string, value: number) => void;
}) {
  const firstParameter = parameters[0];
  if (!firstParameter) {
    return null;
  }

  return (
    <SettingsRow
      label={firstParameter.rowLabel ?? firstParameter.label}
      testID={`trading-view-indicator-parameter-${firstParameter.rowId ?? firstParameter.id}`}
    >
      <XStack gap="$2" alignItems="center" flexWrap="wrap" flexShrink={1}>
        {parameters.map((parameter) => (
          <TradingViewIndicatorNumberInput
            key={parameter.id}
            value={parameter.value}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step}
            onChange={(value) => onChange(parameter.id, value)}
          />
        ))}
      </XStack>
    </SettingsRow>
  );
}

export function groupTradingViewIndicatorParameters(
  parameters: ITradingViewSettingsMockNumberParam[] = [],
) {
  const rows: ITradingViewSettingsMockNumberParam[][] = [];
  const rowIndexes = new Map<string, number>();

  parameters.forEach((parameter) => {
    const rowKey = parameter.rowId ?? parameter.id;
    const rowIndex = rowIndexes.get(rowKey);
    if (rowIndex === undefined) {
      rowIndexes.set(rowKey, rows.length);
      rows.push([parameter]);
      return;
    }

    rows[rowIndex]?.push(parameter);
  });

  return rows;
}

export function TradingViewIndicatorLineRow({
  line,
  onToggleLine,
  onPeriodChange,
  onStyleChange,
  onSecondaryStyleChange,
  onColorChange,
}: {
  line: ITradingViewSettingsMockLine;
  onToggleLine: (lineId: string, enabled: boolean) => void;
  onPeriodChange: (lineId: string, period: number) => void;
  onStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onSecondaryStyleChange: (
    lineId: string,
    style: ITradingViewSettingsMockLineStyle,
  ) => void;
  onColorChange: (lineId: string, color: string) => void;
}) {
  const intl = useIntl();
  const showCheckbox = line.showCheckbox !== false;
  const showPeriod = line.showPeriod !== false;
  const showStyle = line.showStyle !== false;
  const showColor = line.showColor !== false;
  const showSecondaryStyle = line.showSecondaryStyle ?? showStyle;
  const lineStyleTitle = intl.formatMessage({
    id: ETranslations.market_chart_settings__line_style,
  });
  const lineStyleOptions = TRADING_VIEW_INDICATOR_LINE_STYLE_OPTIONS.filter(
    (option) =>
      (showStyle || option.style === 'solid') &&
      (showSecondaryStyle || option.pattern === 'solid'),
  );
  const selectedLineStyle =
    lineStyleOptions.find(
      (option) =>
        option.style === (showStyle ? line.style : 'solid') &&
        option.pattern ===
          (showSecondaryStyle && line.secondaryStyle === 'dashed'
            ? 'dashed'
            : 'solid'),
    ) ?? lineStyleOptions[0];

  const controls = (
    <XStack gap="$2" alignItems="center" flexWrap="wrap" flexShrink={1}>
      {showPeriod ? (
        <TradingViewIndicatorNumberInput
          value={line.period}
          width={104}
          min={1}
          onChange={(period) => onPeriodChange(line.id, period)}
        />
      ) : null}
      {showStyle || showSecondaryStyle ? (
        <SettingsSelect
          testID={`indicator-line-style-${line.id}`}
          width={104}
          title={lineStyleTitle}
          value={selectedLineStyle.value}
          options={lineStyleOptions.map((option) => option.value)}
          disabled={false}
          showLinePreview
          optionLabels={Object.fromEntries(
            lineStyleOptions.map((option) => [
              option.value,
              `${intl.formatMessage({
                id:
                  option.pattern === 'dashed'
                    ? ETranslations.market_chart_indicator_dashed_line__label
                    : ETranslations.market_chart_settings__solid_line,
              })}, ${option.width}px`,
            ]),
          )}
          renderOptionLabel={(value) => {
            const option = lineStyleOptions.find(
              (item) => item.value === value,
            );
            return option ? (
              <SettingsLineStylePreview
                style={option.pattern}
                lineWidth={option.width}
              />
            ) : null;
          }}
          onChange={(value) => {
            const option = lineStyleOptions.find(
              (item) => item.value === value,
            );
            if (option) {
              if (showStyle) {
                onStyleChange(line.id, option.style);
              }
              if (showSecondaryStyle) {
                onSecondaryStyleChange(line.id, option.pattern);
              }
            }
          }}
        />
      ) : null}
      {showColor ? (
        <SettingsColorPicker
          testID={`trading-view-indicator-color-${line.id}`}
          value={line.color}
          disabled={false}
          onChange={(color) => onColorChange(line.id, color)}
        />
      ) : null}
    </XStack>
  );

  if (showCheckbox) {
    return (
      <SettingsCheckboxRow
        label={line.label}
        controlsIndent={0}
        testID={`indicator-line-${line.id}`}
        value={line.enabled}
        disabled={false}
        onChange={(enabled) => onToggleLine(line.id, enabled)}
      >
        {controls}
      </SettingsCheckboxRow>
    );
  }

  return (
    <SettingsRow
      label={line.label}
      testID={`trading-view-indicator-line-${line.id}`}
    >
      {controls}
    </SettingsRow>
  );
}

export function TradingViewIndicatorOpacitySlider({
  value,
  label,
  upColor,
  downColor,
  onChange,
  onColorChange,
}: {
  value: number;
  label: string;
  upColor: string;
  downColor: string;
  onChange: (value: number) => void;
  onColorChange: (
    role: ITradingViewSettingsMockColorRole,
    color: string,
  ) => void;
}) {
  const intl = useIntl();

  return (
    <>
      <SettingsRow label={label} testID="trading-view-indicator-opacity-row">
        <XStack gap="$3" alignItems="center" flexWrap="wrap" flexShrink={1}>
          <SettingsColorField
            label={intl.formatMessage({
              id: ETranslations.market_chart_settings__up,
            })}
            testID="trading-view-indicator-opacity-up-color"
            value={upColor}
            disabled={false}
            onChange={(color) => onColorChange('up', color)}
          />
          <SettingsColorField
            label={intl.formatMessage({
              id: ETranslations.market_chart_settings__down,
            })}
            testID="trading-view-indicator-opacity-down-color"
            value={downColor}
            disabled={false}
            onChange={(color) => onColorChange('down', color)}
          />
        </XStack>
      </SettingsRow>
      {/* Same inset as a settings row so the track lines up with the labels. */}
      <XStack mx="$2.5" px="$2.5" py="$1.5" gap="$4" alignItems="center">
        {/* SegmentSlider takes no testID, so the wrapper carries it. */}
        <Stack testID="trading-view-indicator-opacity-slider" flex={1}>
          <SegmentSlider
            min={0}
            max={100}
            segments={TRADING_VIEW_INDICATOR_OPACITY_SEGMENTS}
            // Web snaps taps on a mark by itself; native needs the opt-in to
            // match it. Drags stay free on both.
            snapTapToSegment
            sliderHeight={2}
            showBubble={false}
            value={value}
            onChange={(nextValue) => onChange(Math.round(nextValue))}
          />
        </Stack>
        <SizableText
          testID="trading-view-indicator-opacity-value"
          size="$bodyMd"
          color="$textSubdued"
          minWidth={44}
          textAlign="right"
        >
          {value}%
        </SizableText>
      </XStack>
    </>
  );
}
