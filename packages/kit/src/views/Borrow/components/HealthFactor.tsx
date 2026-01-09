import { useCallback, useMemo, useState } from 'react';

import {
  Icon,
  LinearGradient,
  SizableText,
  Stack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

import type { LayoutChangeEvent } from 'react-native';

type IHealthFactorProps = {
  value: number;
  index?: number;
  min?: number;
  max?: number;
  thresholdValue?: number;
  liquidationText?: IEarnText;
};

type IIndicatorProps = {
  percent: number;
  containerWidth: number;
  children: React.ReactNode;
  position: 'top' | 'bottom';
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
  index,
  min = 0,
  max = 3,
  thresholdValue = 1,
  liquidationText,
}: IHealthFactorProps) => {
  const theme = useTheme();
  const criticalColor = theme.bgCriticalStrong.val;
  const cautionColor = theme.bgCautionStrong.val;
  const successColor = theme.bgSuccessStrong.val;

  const [containerWidth, setContainerWidth] = useState(0);

  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  const { displayValue, pointerPercent, thresholdPercent } = useMemo(() => {
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

    return {
      displayValue: valueIsFinite ? value.toFixed(2) : '-',
      pointerPercent: computedPointerPercent,
      thresholdPercent: canComputeThreshold
        ? ((clampedThreshold - safeMin) / range) * 100
        : 0,
    };
  }, [index, max, min, thresholdValue, value]);

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
            <SizableText size="$bodySmMedium" whiteSpace="nowrap">
              {displayValue}
            </SizableText>
            <Icon
              name="ChevronTriangleDownSmallOutline"
              size="$4"
              color="$text"
            />
          </YStack>
        </Indicator>
      </Stack>

      {/* Gradient bar */}
      <LinearGradient
        start={[0, 0]}
        end={[1, 0]}
        colors={[criticalColor, cautionColor, successColor]}
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
