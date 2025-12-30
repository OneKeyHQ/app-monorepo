import { useMemo } from 'react';

import { colord, extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';

import {
  Icon,
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

extend([mixPlugin]);

type IHealthFactorProps = {
  value: number;
  min?: number;
  max?: number;
  thresholdValue?: number;
  liquidationText?: IEarnText;
};

const getGradientColorAtPercent = (
  percent: number,
  startColor: string,
  middleColor: string,
  endColor: string,
) => {
  const ratio = Math.min(Math.max(percent / 100, 0), 1);
  if (ratio <= 0.5) {
    return colord(startColor)
      .mix(middleColor, ratio * 2)
      .toRgbString();
  }
  return colord(middleColor)
    .mix(endColor, (ratio - 0.5) * 2)
    .toRgbString();
};

const getTextAlignment = (
  percent: number,
): 'flex-start' | 'center' | 'flex-end' => {
  if (percent < 15) {
    return 'flex-start';
  }
  if (percent > 85) {
    return 'flex-end';
  }
  return 'center';
};

export const HealthFactor = ({
  value,
  min = 0,
  max = 3,
  thresholdValue = 1,
  liquidationText,
}: IHealthFactorProps) => {
  const theme = useTheme();
  const criticalColor = theme.bgCriticalStrong.val;
  const cautionColor = theme.bgCautionStrong.val;
  const successColor = theme.bgSuccessStrong.val;

  const { displayValue, pointerPercent, thresholdPercent } = useMemo(() => {
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMaxInput = Number.isFinite(max) ? max : safeMin;
    const safeMax = Math.max(safeMaxInput, safeMin + 0.0001);
    const range = safeMax - safeMin;

    const clampToRange = (input: number) =>
      Math.min(Math.max(input, safeMin), safeMax);

    const valueIsFinite = Number.isFinite(value);
    const thresholdIsFinite = Number.isFinite(thresholdValue);
    const clampedValue = valueIsFinite ? clampToRange(value) : safeMin;
    const clampedThreshold = thresholdIsFinite
      ? clampToRange(thresholdValue)
      : safeMin;
    const canComputePointer =
      valueIsFinite && Number.isFinite(range) && range > 0;
    const canComputeThreshold =
      thresholdIsFinite && Number.isFinite(range) && range > 0;

    return {
      displayValue: valueIsFinite ? value.toFixed(2) : '-',
      pointerPercent: canComputePointer
        ? ((clampedValue - safeMin) / range) * 100
        : 0,
      thresholdPercent: canComputeThreshold
        ? ((clampedThreshold - safeMin) / range) * 100
        : 0,
    };
  }, [max, min, thresholdValue, value]);

  const thresholdIndicatorColor = useMemo(
    () =>
      getGradientColorAtPercent(
        thresholdPercent,
        criticalColor,
        cautionColor,
        successColor,
      ),
    [cautionColor, criticalColor, successColor, thresholdPercent],
  );

  const pointerTextAlignment = getTextAlignment(pointerPercent);
  const thresholdTextAlignment = getTextAlignment(thresholdPercent);

  return (
    <YStack mt="$4" mb="$1.5">
      {/* Upper indicator: current health factor value */}
      <Stack position="relative" h="$8" mb="$1">
        <Stack
          position="absolute"
          left={`${pointerPercent}%`}
          bottom={0}
          w={0}
          overflow="visible"
        >
          <YStack ai={pointerTextAlignment}>
            <SizableText size="$bodySmMedium" whiteSpace="nowrap">
              {displayValue}
            </SizableText>
            <Icon
              name="ChevronTriangleDownSmallOutline"
              size="$4"
              color="$bgInverse"
            />
          </YStack>
        </Stack>
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
        <Stack
          position="absolute"
          left={`${thresholdPercent}%`}
          top={0}
          w={0}
          overflow="visible"
        >
          <YStack ai={thresholdTextAlignment}>
            <Icon
              name="ChevronTriangleUpSmallOutline"
              size="$4"
              style={{ color: thresholdIndicatorColor }}
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
        </Stack>
      </Stack>
    </YStack>
  );
};
