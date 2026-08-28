import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Input,
  SizableText,
  Slider,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  TRADING_VIEW_CHART_BG,
  TRADING_VIEW_CHART_SELECT_BG,
  TRADING_VIEW_CHART_SELECT_BORDER,
  TRADING_VIEW_CHART_TEXT,
  TRADING_VIEW_LINE_PREVIEW_DASHES,
  TradingViewChartCheckbox,
  TradingViewChartColorPicker,
  TradingViewChartSelectMock,
  TradingViewChartSolidSwatch,
} from './TradingViewSettingsShared';

import type {
  ITradingViewSettingsMockColorRole,
  ITradingViewSettingsMockLine,
  ITradingViewSettingsMockLineStyle,
  ITradingViewSettingsMockNumberParam,
} from './TradingViewSettingsMockState';
const TRADING_VIEW_INDICATOR_FIELD_LABEL_WIDTH = 136;
const TRADING_VIEW_INDICATOR_COMPACT_SLIDER_WIDTH = 210;
const TRADING_VIEW_INDICATOR_DEFAULT_SLIDER_WIDTH = 370;
const TRADING_VIEW_INDICATOR_LINE_STYLE_OPTIONS: ITradingViewSettingsMockLineStyle[] =
  ['solid', 'medium', 'bold', 'extraBold'];

function TradingViewIndicatorLinePreview({
  style,
  color = TRADING_VIEW_CHART_TEXT,
  width = 76,
}: {
  style: ITradingViewSettingsMockLineStyle;
  color?: string;
  width?: number;
}) {
  if (style === 'dashed') {
    return (
      <XStack w={width} h={2} gap={4} alignItems="center">
        {TRADING_VIEW_LINE_PREVIEW_DASHES.map((dash) => (
          <Stack key={dash} w={6} h={1} bg={color} />
        ))}
      </XStack>
    );
  }

  if (style === 'dotted') {
    return (
      <XStack w={width} h={2} gap={6} alignItems="center">
        {TRADING_VIEW_LINE_PREVIEW_DASHES.map((dot) => (
          <Stack key={dot} w={2} h={2} borderRadius={1} bg={color} />
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

  return <Stack w={width} h={lineHeight} bg={color} />;
}

function TradingViewIndicatorLineStyleSelect({
  value,
  testID,
  onChange,
}: {
  value: ITradingViewSettingsMockLineStyle;
  testID?: string;
  onChange: (value: ITradingViewSettingsMockLineStyle) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Stack position="relative" zIndex={isOpen ? 30 : 1}>
      <XStack
        testID={testID}
        w={120}
        h={34}
        px={12}
        alignItems="center"
        justifyContent="space-between"
        borderRadius={6}
        borderWidth={1}
        borderColor={
          isOpen ? '$borderActive' : TRADING_VIEW_CHART_SELECT_BORDER
        }
        bg={TRADING_VIEW_CHART_SELECT_BG}
        hoverStyle={{ borderColor: '$borderStrong', bg: '$bgStrongHover' }}
        pressStyle={{ bg: '$bgStrongActive' }}
        cursor="pointer"
        onPress={() => setIsOpen((current) => !current)}
      >
        <TradingViewIndicatorLinePreview style={value} />
        <Icon
          name={isOpen ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
          size="$4"
          color="$icon"
        />
      </XStack>
      {isOpen ? (
        <YStack
          position="absolute"
          top={42}
          left={0}
          w={120}
          overflow="hidden"
          borderRadius={6}
          bg="$bgSubdued"
          zIndex={100}
        >
          {TRADING_VIEW_INDICATOR_LINE_STYLE_OPTIONS.map((option) => (
            <XStack
              key={option}
              h={33}
              px={13}
              alignItems="center"
              bg="$bgSubdued"
              hoverStyle={{ bg: '$bgStrongHover' }}
              cursor="pointer"
              onPress={() => {
                onChange(option);
                setIsOpen(false);
              }}
            >
              <TradingViewIndicatorLinePreview
                style={option}
                color="$text"
                width={94}
              />
            </XStack>
          ))}
        </YStack>
      ) : null}
    </Stack>
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
    <XStack
      w={120}
      h={32}
      overflow="hidden"
      alignItems="center"
      borderRadius={6}
      bg={TRADING_VIEW_CHART_SELECT_BG}
      hoverStyle={{ bg: '$bgStrongHover' }}
    >
      <Input
        testID="trading-view-indicator-number-input"
        size="small"
        value={inputValue}
        keyboardType="decimal-pad"
        returnKeyType="done"
        selectTextOnFocus
        autoCorrect={false}
        fontSize={14}
        color={TRADING_VIEW_CHART_TEXT}
        containerProps={{
          flex: 1,
          h: 32,
          borderWidth: 0,
          borderRadius: 0,
          bg: 'transparent',
        }}
        InputComponentStyle={{
          h: 32,
          px: 11,
          py: 0,
          bg: 'transparent',
        }}
        onChangeText={setInputValue}
        onBlur={commitInputValue}
        onSubmitEditing={commitInputValue}
      />
      <YStack w={24} h={32} borderLeftWidth={1} borderLeftColor="$borderStrong">
        <Stack
          flex={1}
          alignItems="center"
          justifyContent="center"
          hoverStyle={{ bg: '$bgStrongHover' }}
          pressStyle={{ bg: '$bgStrongActive' }}
          cursor="pointer"
          onPress={() => stepInputValue(1)}
        >
          <Icon name="ChevronTopSmallOutline" size="$4" color="$iconSubdued" />
        </Stack>
        <Stack h={1} bg="$borderStrong" />
        <Stack
          flex={1}
          alignItems="center"
          justifyContent="center"
          hoverStyle={{ bg: '$bgStrongHover' }}
          pressStyle={{ bg: '$bgStrongActive' }}
          cursor="pointer"
          onPress={() => stepInputValue(-1)}
        >
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </Stack>
      </YStack>
    </XStack>
  );
}

export function TradingViewIndicatorParameterRow({
  compact = false,
  parameters,
  onChange,
}: {
  compact?: boolean;
  parameters: ITradingViewSettingsMockNumberParam[];
  onChange: (parameterId: string, value: number) => void;
}) {
  const firstParameter = parameters[0];
  if (!firstParameter) {
    return null;
  }

  return (
    <XStack
      h={compact ? undefined : 48}
      minHeight={48}
      py={compact ? 8 : undefined}
      rowGap={compact ? 8 : undefined}
      flexWrap={compact ? 'wrap' : 'nowrap'}
      alignItems="center"
    >
      <SizableText
        w={compact ? '100%' : TRADING_VIEW_INDICATOR_FIELD_LABEL_WIDTH}
        fontSize={14}
        lineHeight={18}
        color={TRADING_VIEW_CHART_TEXT}
      >
        {firstParameter.rowLabel ?? firstParameter.label}
      </SizableText>
      <XStack gap={8}>
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
    </XStack>
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
  compact = false,
  line,
  colorPickerPlacement,
  onToggleLine,
  onPeriodChange,
  onStyleChange,
  onSecondaryStyleChange,
  onColorChange,
}: {
  compact?: boolean;
  line: ITradingViewSettingsMockLine;
  colorPickerPlacement: 'bottom' | 'top';
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
  const solidLineLabel = intl.formatMessage({
    id: ETranslations.market_chart_settings__solid_line,
  });
  const dashedLineLabel = intl.formatMessage({
    id: ETranslations.market_chart_indicator_dashed_line__label,
  });
  const secondaryStyleOptions = [solidLineLabel, dashedLineLabel];

  return (
    <XStack
      h={compact ? undefined : 48}
      minHeight={48}
      py={compact ? 8 : undefined}
      rowGap={compact ? 8 : undefined}
      flexWrap={compact ? 'wrap' : 'nowrap'}
      alignItems="center"
    >
      <XStack
        w={compact ? '100%' : TRADING_VIEW_INDICATOR_FIELD_LABEL_WIDTH}
        alignItems="center"
      >
        {showCheckbox ? (
          <TradingViewChartCheckbox
            checked={line.enabled}
            onChange={(checked) => onToggleLine(line.id, checked)}
          />
        ) : null}
        <SizableText
          ml={showCheckbox ? 12 : 0}
          fontSize={14}
          lineHeight={18}
          color={TRADING_VIEW_CHART_TEXT}
        >
          {line.label}
        </SizableText>
      </XStack>
      {showPeriod ? (
        <TradingViewIndicatorNumberInput
          value={line.period}
          min={1}
          onChange={(period) => onPeriodChange(line.id, period)}
        />
      ) : null}
      {showStyle ? (
        <Stack ml={8}>
          <TradingViewIndicatorLineStyleSelect
            value={line.style}
            testID={`trading-view-indicator-line-style-${line.id}`}
            onChange={(style) => onStyleChange(line.id, style)}
          />
        </Stack>
      ) : null}
      {showColor ? (
        <Stack
          ml={
            compact
              ? 8
              : (line.colorOffset ?? (showPeriod || showStyle ? 8 : 0))
          }
        >
          <TradingViewChartColorPicker
            placement={line.colorPickerPlacement ?? colorPickerPlacement}
            align="right"
            pattern={line.colorPattern}
            value={line.color}
            testID={`trading-view-indicator-color-${line.id}`}
            onChange={(color) => onColorChange(line.id, color)}
          />
        </Stack>
      ) : null}
      {showSecondaryStyle ? (
        <Stack ml={8}>
          <TradingViewChartSelectMock
            value={
              line.secondaryStyle === 'dashed'
                ? dashedLineLabel
                : solidLineLabel
            }
            width={97}
            options={secondaryStyleOptions}
            showLinePreview
            getLinePreviewVariant={(value) =>
              value === dashedLineLabel ? 'dashed' : 'solid'
            }
            onChange={(value) =>
              onSecondaryStyleChange(
                line.id,
                value === dashedLineLabel ? 'dashed' : 'solid',
              )
            }
          />
        </Stack>
      ) : null}
    </XStack>
  );
}

export function TradingViewIndicatorOpacitySlider({
  compact = false,
  value,
  label,
  upColor,
  downColor,
  onChange,
  onColorChange,
}: {
  compact?: boolean;
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
  const points = [0, 25, 50, 75, 100];
  const [isSliderHovered, setIsSliderHovered] = useState(false);
  const [isSliderDragging, setIsSliderDragging] = useState(false);
  const isCurrentPointActive = isSliderHovered || isSliderDragging;
  const currentPointSize = isCurrentPointActive ? 12 : 8;
  const sliderWidth = compact
    ? TRADING_VIEW_INDICATOR_COMPACT_SLIDER_WIDTH
    : TRADING_VIEW_INDICATOR_DEFAULT_SLIDER_WIDTH;
  const sliderTouchWidth = sliderWidth + 16;
  const handleSliderPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const currentPointX = 8 + (value / 100) * sliderWidth;
      setIsSliderHovered(Math.abs(pointerX - currentPointX) <= 8);
    },
    [sliderWidth, value],
  );

  return (
    <YStack mt={18} gap={8}>
      <XStack alignItems="center" justifyContent="space-between">
        <SizableText
          fontSize={14}
          lineHeight={18}
          color={TRADING_VIEW_CHART_TEXT}
        >
          {label}
        </SizableText>
        <XStack gap={18}>
          <TradingViewChartSolidSwatch
            color={upColor}
            placement="top"
            align="right"
            bare
            onChange={(color) => onColorChange('up', color)}
          />
          <TradingViewChartSolidSwatch
            color={downColor}
            placement="top"
            align="right"
            bare
            onChange={(color) => onColorChange('down', color)}
          />
        </XStack>
      </XStack>
      <XStack h={34} position="relative" alignItems="center">
        <Stack w={sliderWidth} h={2} position="relative" bg="$borderStrong">
          <Stack w={(value / 100) * sliderWidth} h={2} bg="$text" />
        </Stack>
        <SizableText
          testID="trading-view-indicator-opacity-value"
          ml={compact ? 12 : 28}
          fontSize={14}
          lineHeight={18}
          color={TRADING_VIEW_CHART_TEXT}
        >
          {value}%
        </SizableText>
        {points.map((point) => (
          <Stack
            key={point}
            position="absolute"
            left={(point / 100) * sliderWidth - 4}
            top={13}
            w={8}
            h={8}
            borderRadius={4}
            borderWidth={1}
            borderColor={point < value ? '$text' : '$borderStrong'}
            bg={TRADING_VIEW_CHART_BG}
            pointerEvents="none"
          />
        ))}
        <Stack
          position="absolute"
          left={(value / 100) * sliderWidth - currentPointSize / 2}
          top={17 - currentPointSize / 2}
          w={currentPointSize}
          h={currentPointSize}
          borderRadius={currentPointSize / 2}
          borderWidth={2}
          borderColor="$text"
          bg={TRADING_VIEW_CHART_BG}
          pointerEvents="none"
        />
        <Stack
          position="absolute"
          top={0}
          left={-8}
          w={sliderTouchWidth}
          h={34}
          opacity={0.001}
          cursor="pointer"
          onPointerEnter={(event) =>
            handleSliderPointerMove(
              event as unknown as PointerEvent<HTMLDivElement>,
            )
          }
          onPointerMove={handleSliderPointerMove}
          onPointerLeave={() => setIsSliderHovered(false)}
        >
          <Slider
            testID="trading-view-indicator-opacity-slider"
            w={sliderTouchWidth}
            h={34}
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(nextValue) => onChange(Math.round(nextValue))}
            onSlideStart={() => setIsSliderDragging(true)}
            onSlideEnd={() => setIsSliderDragging(false)}
          />
        </Stack>
      </XStack>
      <XStack w={sliderWidth} justifyContent="space-between">
        <SizableText
          fontSize={12}
          lineHeight={14}
          color={TRADING_VIEW_CHART_TEXT}
        >
          0
        </SizableText>
        <SizableText
          fontSize={12}
          lineHeight={14}
          color={TRADING_VIEW_CHART_TEXT}
        >
          100%
        </SizableText>
      </XStack>
    </YStack>
  );
}
