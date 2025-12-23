import { useMemo } from 'react';

import { colord, extend } from 'colord';
import mixPlugin from 'colord/plugins/mix';

import {
  Icon,
  LinearGradient,
  SizableText,
  Stack,
  YStack,
  useThemeValue,
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

export const HealthFactor = ({
  value,
  min = 0,
  max = 3,
  thresholdValue = 1,
  liquidationText,
}: IHealthFactorProps) => {
  const [criticalColor, cautionColor, successColor] = useThemeValue(
    ['bgCriticalStrong', 'bgCautionStrong', 'bgSuccessStrong'],
    undefined,
    true,
  );

  const { displayValue, pointerPercent, thresholdPercent } = useMemo(() => {
    const safeMin = min;
    const safeMax = Math.max(max, safeMin + 0.0001);
    const range = safeMax - safeMin;

    const clampToRange = (input: number) =>
      Math.min(Math.max(input, safeMin), safeMax);

    const clampedValue = clampToRange(value);
    const clampedThreshold = clampToRange(thresholdValue);

    return {
      displayValue: value.toFixed(2),
      pointerPercent: ((clampedValue - safeMin) / range) * 100,
      thresholdPercent: ((clampedThreshold - safeMin) / range) * 100,
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

  return (
    <YStack gap="$2" mt="$4" mb="$1.5">
      <Stack h="$10" position="relative" justifyContent="center">
        <YStack
          position="absolute"
          left={`${pointerPercent}%`}
          bottom="50%"
          transform={[{ translateX: '-50%' as never }]}
          ai="center"
          gap="$0"
          zIndex="$1"
        >
          <SizableText size="$bodySmMedium">{displayValue}</SizableText>
          <Icon
            name="ChevronTriangleDownSmallOutline"
            size="$4"
            color="$bgInverse"
          />
        </YStack>
        <YStack
          position="absolute"
          left={`${thresholdPercent}%`}
          top="50%"
          transform={[{ translateX: '-50%' as never }]}
          ai="center"
          gap="$0"
        >
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
            />
          ) : null}
        </YStack>
        <LinearGradient
          start={[0, 0]}
          end={[1, 0]}
          colors={['bgCriticalStrong', 'bgCautionStrong', 'bgSuccessStrong']}
          height="$1"
          borderRadius={9999}
        />
      </Stack>
    </YStack>
  );
};
