import { useCallback, useMemo, useState } from 'react';

import { LinearGradient, Stack, YStack, useTheme } from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

import type { LayoutChangeEvent } from 'react-native';

type IHealthFactorProps = {
  value: number;
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

const TRACK_HEIGHT = 6;
const KNOB_SIZE = 14;
const TICK_WIDTH = 2;
const TICK_HEIGHT = 12;

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

export const HealthFactor = ({
  value,
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

  const { pointerPercent, thresholdPercent, hasThreshold } = useMemo(() => {
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
      pointerPercent: computedPointerPercent,
      thresholdPercent: computedThresholdPercent,
      hasThreshold: thresholdIndexIsFinite || canComputeThreshold,
    };
  }, [index, max, min, thresholdIndex, thresholdValue, value]);

  const knobLeft = Math.min(
    Math.max((containerWidth * pointerPercent) / 100 - KNOB_SIZE / 2, 0),
    Math.max(containerWidth - KNOB_SIZE, 0),
  );
  const tickLeft = Math.min(
    Math.max((containerWidth * thresholdPercent) / 100 - TICK_WIDTH / 2, 0),
    Math.max(containerWidth - TICK_WIDTH, 0),
  );

  return (
    <YStack gap="$2">
      <Stack
        position="relative"
        h={KNOB_SIZE}
        jc="center"
        onLayout={onContainerLayout}
      >
        <LinearGradient
          start={[0, 0]}
          end={[1, 0]}
          colors={gradientColors}
          locations={gradientLocations}
          height={TRACK_HEIGHT}
          width="100%"
          borderRadius={9999}
        />
        {containerWidth > 0 && hasThreshold ? (
          // Liquidation threshold: a notch cut into the track
          <Stack
            position="absolute"
            left={tickLeft}
            top={(KNOB_SIZE - TICK_HEIGHT) / 2}
            w={TICK_WIDTH}
            h={TICK_HEIGHT}
            borderRadius={1}
            bg="$bgApp"
          />
        ) : null}
        {containerWidth > 0 ? (
          // Current position: risk-colored knob ringed with the page background
          <Stack
            position="absolute"
            left={knobLeft}
            top={0}
            w={KNOB_SIZE}
            h={KNOB_SIZE}
            borderRadius="$full"
            bg={valueColor ?? '$text'}
            borderWidth={2}
            borderColor="$bgApp"
          />
        ) : null}
      </Stack>
      {liquidationText ? (
        <EarnText size="$bodySm" color="$textSubdued" text={liquidationText} />
      ) : null}
    </YStack>
  );
};
