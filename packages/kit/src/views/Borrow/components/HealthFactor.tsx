import { useMemo } from 'react';

import {
  Icon,
  LinearGradient,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';

type IHealthFactorProps = {
  value: number;
  min?: number;
  max?: number;
  thresholdValue?: number;
};

export const HealthFactor = ({
  value,
  min = 0,
  max = 3,
  thresholdValue = 1,
}: IHealthFactorProps) => {
  const { clampedValue, pointerPercent, thresholdPercent } = useMemo(() => {
    const safeMin = min;
    const safeMax = Math.max(max, safeMin + 0.0001);
    const range = safeMax - safeMin;
    const clampToRange = (input: number) =>
      Math.min(Math.max(input, safeMin), safeMax);
    const clamped = clampToRange(value);
    const percent = ((clamped - safeMin) / range) * 100;
    const threshold = clampToRange(thresholdValue);
    const thresholdPct = ((threshold - safeMin) / range) * 100;

    return {
      clampedValue: clamped,
      pointerPercent: percent,
      thresholdPercent: thresholdPct,
    };
  }, [max, min, thresholdValue, value]);

  return (
    <YStack gap="$2">
      <Stack h="$10" position="relative">
        <Stack
          position="absolute"
          left={`${pointerPercent}%`}
          transform={[{ translateX: '-50%' as never }]}
          ai="center"
          gap="$1"
        >
          <SizableText size="$bodyMdMedium">
            {clampedValue.toFixed(2)}
          </SizableText>
          <Icon
            name="ChevronTriangleDownSmallOutline"
            size="$4"
            color="$iconSubdued"
          />
        </Stack>
        <Stack
          position="absolute"
          left={`${thresholdPercent}%`}
          bottom={-6}
          transform={[{ translateX: '-50%' as never }]}
          ai="center"
        >
          <Icon
            name="ChevronTriangleUpSmallOutline"
            size="$4"
            color="$iconCritical"
          />
        </Stack>
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
