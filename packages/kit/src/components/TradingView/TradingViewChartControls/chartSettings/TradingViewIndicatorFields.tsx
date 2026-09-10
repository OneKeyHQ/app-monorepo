import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import {
  ColorPicker,
  Input,
  SegmentSlider,
  SizableText,
  Stack,
  XStack,
  useThemeName,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  SettingsCheckboxRow,
  SettingsColorField,
  SettingsColorPicker,
  SettingsRow,
  SettingsSelect,
} from './TradingViewSettingsPrimitives';
import { TRADING_VIEW_SETTINGS_COLOR_PALETTE } from './TradingViewSettingsShared';
import {
  resolveTradingViewSettingsThemeColor,
  useTradingViewSettingsThemeColors,
} from './TradingViewSettingsThemeColors';

import type {
  ITradingViewSettingsMockColorRole,
  ITradingViewSettingsMockLine,
  ITradingViewSettingsMockLineStyle,
  ITradingViewSettingsMockNumberParam,
} from './TradingViewSettingsMockState';

const TRADING_VIEW_INDICATOR_NUMBER_INPUT_WIDTH = 128;
// Same footprint as the settings dialog's line preview (`$8` wide, 2px tall).
const TRADING_VIEW_INDICATOR_LINE_PREVIEW_WIDTH = 32;
const TRADING_VIEW_INDICATOR_LINE_PREVIEW_DASHES = [0, 1, 2, 3, 4, 5];
const TRADING_VIEW_INDICATOR_LINE_STYLE_OPTIONS: ITradingViewSettingsMockLineStyle[] =
  ['solid', 'medium', 'bold', 'extraBold'];
const TRADING_VIEW_INDICATOR_SECONDARY_STYLE_OPTIONS = [
  'solid',
  'dashed',
] as const satisfies readonly ITradingViewSettingsMockLineStyle[];
const TRADING_VIEW_INDICATOR_OPACITY_SEGMENTS = 4;

function TradingViewIndicatorLinePreview({
  style,
}: {
  style: ITradingViewSettingsMockLineStyle;
}) {
  if (style === 'dashed') {
    return (
      <XStack
        w={TRADING_VIEW_INDICATOR_LINE_PREVIEW_WIDTH}
        h={2}
        gap="$0.5"
        alignItems="center"
      >
        {TRADING_VIEW_INDICATOR_LINE_PREVIEW_DASHES.map((dash) => (
          <Stack key={dash} w="$1" h={2} bg="$iconSubdued" />
        ))}
      </XStack>
    );
  }

  if (style === 'dotted') {
    return (
      <XStack
        w={TRADING_VIEW_INDICATOR_LINE_PREVIEW_WIDTH}
        h={2}
        gap="$1"
        alignItems="center"
      >
        {TRADING_VIEW_INDICATOR_LINE_PREVIEW_DASHES.map((dot) => (
          <Stack key={dot} w={2} h={2} borderRadius="$full" bg="$iconSubdued" />
        ))}
      </XStack>
    );
  }

  const lineHeight = {
    solid: 1,
    medium: 2,
    bold: 3,
    extraBold: 4,
  }[style];

  return (
    <Stack
      w={TRADING_VIEW_INDICATOR_LINE_PREVIEW_WIDTH}
      h={lineHeight}
      bg="$iconSubdued"
    />
  );
}

function TradingViewIndicatorCheckerColorTrigger({
  testID,
  color,
  checkerColor,
  disabled,
  onPress,
}: {
  testID?: string;
  color: string;
  checkerColor: string;
  disabled?: boolean;
  // The ColorPicker popover clones its trigger element to inject the press
  // handler, the same way the design-system default trigger receives it.
  onPress?: IStackProps['onPress'];
}) {
  return (
    <Stack
      testID={testID}
      w={32}
      h={32}
      p="$1"
      borderRadius="$2"
      borderWidth="$px"
      borderColor="$borderSubdued"
      bg="$bgStrong"
      opacity={disabled ? 0.5 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
    >
      <Stack
        flex={1}
        borderRadius="$1"
        style={{
          background: `repeating-conic-gradient(${color} 0% 25%, ${checkerColor} 0% 50%) 50% / 6px 6px`,
        }}
      />
    </Stack>
  );
}

function TradingViewIndicatorColorPicker({
  testID,
  value,
  pattern,
  onChange,
}: {
  testID?: string;
  value: string;
  pattern?: 'checker';
  onChange: (value: string) => void;
}) {
  const themeColors = useTradingViewSettingsThemeColors();
  const themeName = useThemeName();

  if (pattern !== 'checker') {
    return (
      <SettingsColorPicker
        testID={testID}
        value={value}
        disabled={false}
        onChange={onChange}
      />
    );
  }

  // Band fills keep their checker swatch so a translucent fill reads as one;
  // the trigger frame matches the design-system ColorPicker trigger.
  const resolvedValue = resolveTradingViewSettingsThemeColor(
    value,
    themeColors,
  );
  const checkerColor =
    themeName === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';

  return (
    <ColorPicker
      value={value}
      colors={TRADING_VIEW_SETTINGS_COLOR_PALETTE}
      columns={5}
      triggerSize={32}
      testID={testID}
      onChange={onChange}
      renderTrigger={({ disabled }) => (
        <TradingViewIndicatorCheckerColorTrigger
          testID={testID ? `${testID}-trigger` : undefined}
          color={resolvedValue}
          checkerColor={checkerColor}
          disabled={disabled}
        />
      )}
    />
  );
}

function TradingViewIndicatorNumberInput({
  value,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
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
    <Input
      testID="trading-view-indicator-number-input"
      size="small"
      containerProps={{ w: TRADING_VIEW_INDICATOR_NUMBER_INPUT_WIDTH }}
      value={inputValue}
      keyboardType="decimal-pad"
      returnKeyType="done"
      selectTextOnFocus
      autoCorrect={false}
      addOns={[
        {
          testID: 'trading-view-indicator-number-input-increment',
          iconName: 'ChevronTopSmallOutline',
          onPress: () => stepInputValue(1),
        },
        {
          testID: 'trading-view-indicator-number-input-decrement',
          iconName: 'ChevronDownSmallOutline',
          onPress: () => stepInputValue(-1),
        },
      ]}
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
  const showSecondaryStyle = line.showSecondaryStyle === true;
  const lineStyleTitle = intl.formatMessage({
    id: ETranslations.market_chart_settings__line_style,
  });

  const controls = (
    <XStack gap="$3" alignItems="center" flexWrap="wrap" flexShrink={1}>
      {showPeriod ? (
        <TradingViewIndicatorNumberInput
          value={line.period}
          min={1}
          onChange={(period) => onPeriodChange(line.id, period)}
        />
      ) : null}
      {showStyle ? (
        <SettingsSelect
          testID={`indicator-line-style-${line.id}`}
          title={lineStyleTitle}
          value={line.style}
          options={TRADING_VIEW_INDICATOR_LINE_STYLE_OPTIONS}
          disabled={false}
          renderTriggerContent={(style) => (
            <TradingViewIndicatorLinePreview style={style} />
          )}
          renderOption={(style) => (
            <TradingViewIndicatorLinePreview style={style} />
          )}
          onChange={(style) => onStyleChange(line.id, style)}
        />
      ) : null}
      {showColor ? (
        <TradingViewIndicatorColorPicker
          testID={`trading-view-indicator-color-${line.id}`}
          value={line.color}
          pattern={line.colorPattern}
          onChange={(color) => onColorChange(line.id, color)}
        />
      ) : null}
      {showSecondaryStyle ? (
        <SettingsSelect
          testID={`indicator-line-secondary-style-${line.id}`}
          title={lineStyleTitle}
          value={line.secondaryStyle === 'dashed' ? 'dashed' : 'solid'}
          options={TRADING_VIEW_INDICATOR_SECONDARY_STYLE_OPTIONS}
          // Keep the indicator's own "Dashed Line" copy; the shared settings
          // map labels `dashed` as "Dotted line".
          optionTranslationIds={{
            dashed: ETranslations.market_chart_indicator_dashed_line__label,
          }}
          disabled={false}
          showLinePreview
          onChange={(style) => onSecondaryStyleChange(line.id, style)}
        />
      ) : null}
    </XStack>
  );

  if (showCheckbox) {
    return (
      <SettingsCheckboxRow
        label={line.label}
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
