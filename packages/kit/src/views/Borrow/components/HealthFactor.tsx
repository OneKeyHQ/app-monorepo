import { useCallback, useMemo, useState } from 'react';

import {
  Icon,
  LinearGradient,
  SizableText,
  Stack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

import type { LayoutChangeEvent } from 'react-native';

type IHealthFactorProps = {
  value: number;
  displayValue?: string;
  valueColor?: ColorTokens;
  index?: number;
  min?: number;
  max?: number;
  thresholdValue?: number;
  thresholdIndex?: number;
  liquidationText?: IEarnText;
  gradientStops?: IHealthFactorGradientStop[];
  levelColors?: Partial<Record<IHealthFactorLevel, string>>;
};

type IIndicatorProps = {
  percent: number;
  containerWidth: number;
  children: React.ReactNode;
  position: 'top' | 'bottom';
};

export type IHealthFactorLevel = 'critical' | 'warning' | 'success';

export type IHealthFactorGradientStop = {
  percent: number;
  level: IHealthFactorLevel;
};

const DEFAULT_GRADIENT_STOPS: IHealthFactorGradientStop[] = [
  { percent: 0, level: 'critical' },
  { percent: 50, level: 'warning' },
  { percent: 100, level: 'success' },
];

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

const normalizeGradientStops = (
  stops: IHealthFactorGradientStop[],
): IHealthFactorGradientStop[] => {
  const normalized = stops
    .filter((stop) => Number.isFinite(stop.percent))
    .map((stop) => ({
      ...stop,
      percent: clampPercent(stop.percent),
    }))
    .toSorted((a, b) => a.percent - b.percent);

  if (normalized.length < 2) {
    return DEFAULT_GRADIENT_STOPS;
  }

  return normalized;
};

const toGradientLocations = (
  stops: IHealthFactorGradientStop[],
): readonly [number, number, ...number[]] => {
  const locations = stops.map((stop) => stop.percent / 100);
  const first = locations[0] ?? 0;
  const second = locations[1] ?? 1;
  const rest = locations.slice(2);
  return [first, second, ...rest];
};

// Determine text alignment based on position to prevent overflow
const getTextAlignment = (
  percent: number,
): 'flex-start' | 'center' | 'flex-end' => {
  if (percent < 15) {
    return 'flex-start'; // Align left when near left edge
  }
  if (percent > 85) {
    return 'flex-end'; // Align right when near right edge
  }
  return 'center'; // Center when in the middle
};

const Indicator = ({
  percent,
  containerWidth,
  children,
  position,
}: IIndicatorProps) => {
  const [contentWidth, setContentWidth] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContentWidth(e.nativeEvent.layout.width);
  }, []);

  const alignment = getTextAlignment(percent);

  // Calculate pixel position for the indicator point
  const left = useMemo(() => {
    if (containerWidth === 0) return 0;
    const targetPosition = (containerWidth * percent) / 100;

    // Adjust based on alignment to position the indicator correctly
    if (alignment === 'flex-start') {
      // Align left edge of content with target
      return targetPosition;
    }
    if (alignment === 'flex-end') {
      // Align right edge of content with target
      return Math.max(0, targetPosition - contentWidth);
    }
    // Center: align center of content with target
    return Math.max(0, targetPosition - contentWidth / 2);
  }, [containerWidth, percent, contentWidth, alignment]);

  return (
    <Stack
      position="absolute"
      left={left}
      top={position === 'top' ? 0 : undefined}
      bottom={position === 'bottom' ? 0 : undefined}
      onLayout={onLayout}
      opacity={contentWidth > 0 && containerWidth > 0 ? 1 : 0}
    >
      {children}
    </Stack>
  );
};

export const HealthFactor = ({
  value,
  displayValue,
  valueColor,
  index,
  min = 0,
  max = 3,
  thresholdValue = 1,
  thresholdIndex,
  liquidationText,
  gradientStops,
  levelColors,
}: IHealthFactorProps) => {
  const theme = useTheme();
  const { gradientColors, gradientLocations } = useMemo(() => {
    const resolvedLevelColors = {
      critical: levelColors?.critical ?? theme.bgCriticalStrong.val,
      warning: levelColors?.warning ?? theme.bgCautionStrong.val,
      success: levelColors?.success ?? theme.bgSuccessStrong.val,
    };
    const resolvedStops = normalizeGradientStops(
      gradientStops ?? DEFAULT_GRADIENT_STOPS,
    );

    return {
      gradientColors: resolvedStops.map(
        (stop) => resolvedLevelColors[stop.level],
      ),
      gradientLocations: toGradientLocations(resolvedStops),
    };
  }, [
    gradientStops,
    levelColors?.critical,
    levelColors?.warning,
    levelColors?.success,
    theme.bgCriticalStrong.val,
    theme.bgCautionStrong.val,
    theme.bgSuccessStrong.val,
  ]);

  const [containerWidth, setContainerWidth] = useState(0);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const { displayText, pointerPercent, thresholdPercent } = useMemo(() => {
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMaxInput = Number.isFinite(max) ? max : safeMin;
    const safeMax = Math.max(safeMaxInput, safeMin + 0.0001);
    const range = safeMax - safeMin;

    const clampToRange = (input: number) =>
      Math.min(Math.max(input, safeMin), safeMax);

    const valueIsFinite = Number.isFinite(value);
    const thresholdIsFinite = Number.isFinite(thresholdValue);
    const clampedThreshold = thresholdIsFinite
      ? clampToRange(thresholdValue)
      : safeMin;
    const canComputeThreshold =
      thresholdIsFinite && Number.isFinite(range) && range > 0;

    // Use index directly as percentage if provided, otherwise calculate from value
    const indexIsFinite = Number.isFinite(index);
    let computedPointerPercent = 0;
    if (indexIsFinite) {
      // index is already a percentage (0-100), clamp it
      computedPointerPercent = Math.min(Math.max(index as number, 0), 100);
    } else if (valueIsFinite && Number.isFinite(range) && range > 0) {
      const clampedValue = clampToRange(value);
      computedPointerPercent = ((clampedValue - safeMin) / range) * 100;
    }

    // Use thresholdIndex directly as percentage if provided
    const thresholdIndexIsFinite = Number.isFinite(thresholdIndex);
    let computedThresholdPercent = 0;
    if (thresholdIndexIsFinite) {
      computedThresholdPercent = clampPercent(thresholdIndex as number);
    } else if (canComputeThreshold) {
      computedThresholdPercent = ((clampedThreshold - safeMin) / range) * 100;
    }

    return {
      displayText: displayValue ?? (valueIsFinite ? value.toFixed(2) : '-'),
      pointerPercent: computedPointerPercent,
      thresholdPercent: computedThresholdPercent,
    };
  }, [displayValue, index, max, min, thresholdIndex, thresholdValue, value]);

  const pointerAlignment = getTextAlignment(pointerPercent);
  const thresholdAlignment = getTextAlignment(thresholdPercent);

  return (
    <YStack mt="$4" mb="$1.5" onLayout={onContainerLayout}>
      {/* Upper indicator: current health factor value */}
      <Stack position="relative" h="$8" mb="$1">
        <Indicator
          percent={pointerPercent}
          containerWidth={containerWidth}
          position="bottom"
        >
          <YStack ai={pointerAlignment}>
            <SizableText
              size="$bodySmMedium"
              whiteSpace="nowrap"
              color={valueColor ?? '$text'}
            >
              {displayText}
            </SizableText>
            <Stack style={{ transform: [{ rotate: '180deg' }] }}>
              <Icon
                name="ChevronTriangleUpSmallOutline"
                size="$4"
                color={valueColor ?? '$text'}
              />
            </Stack>
          </YStack>
        </Indicator>
      </Stack>

      {/* Gradient bar */}
      <LinearGradient
        start={[0, 0]}
        end={[1, 0]}
        colors={gradientColors}
        locations={gradientLocations}
        height="$1"
        width="100%"
        borderRadius={9999}
      />

      {/* Lower indicator: liquidation threshold */}
      <Stack position="relative" h="$10" mt="$1">
        <Indicator
          percent={thresholdPercent}
          containerWidth={containerWidth}
          position="top"
        >
          <YStack ai={thresholdAlignment}>
            <Icon
              name="ChevronTriangleUpSmallOutline"
              size="$4"
              color="$iconCritical"
            />
            {liquidationText ? (
              <EarnText
                size="$bodySmMedium"
                color="$textCritical"
                text={liquidationText}
                whiteSpace="nowrap"
              />
            ) : null}
          </YStack>
        </Indicator>
      </Stack>
    </YStack>
  );
};
