import { useMemo } from 'react';

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

type IHealthFactorProps = {
  value: number;
  min?: number;
  max?: number;
  thresholdValue?: number;
  liquidationText?: IEarnText;
};

type IRgbColor = {
  r: number;
  g: number;
  b: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const parseHexColor = (value: string): IRgbColor | null => {
  const rawValue = value.replace('#', '').trim();
  let hex = rawValue;
  if (hex.length === 3 || hex.length === 4) {
    hex = hex
      .slice(0, 3)
      .split('')
      .map((item) => item + item)
      .join('');
  } else if (hex.length === 6 || hex.length === 8) {
    hex = hex.slice(0, 6);
  } else {
    return null;
  }

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return { r, g, b };
};

const parseRgbColor = (value: string): IRgbColor | null => {
  const match = value.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return null;
  }
  const parts = match[1].split(',').map((item) => item.trim());
  if (parts.length < 3) {
    return null;
  }

  const parseChannel = (input: string) => {
    if (input.endsWith('%')) {
      return Math.round((Number.parseFloat(input) / 100) * 255);
    }
    return Math.round(Number.parseFloat(input));
  };

  const r = parseChannel(parts[0]);
  const g = parseChannel(parts[1]);
  const b = parseChannel(parts[2]);

  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return { r, g, b };
};

const parseColorToRgb = (value: string): IRgbColor | null => {
  const color = value.trim();
  if (color.startsWith('#')) {
    return parseHexColor(color);
  }
  if (color.startsWith('rgb')) {
    return parseRgbColor(color);
  }
  return null;
};

const interpolateRgb = (
  startColor: IRgbColor,
  endColor: IRgbColor,
  ratio: number,
): IRgbColor => {
  const clampedRatio = clamp(ratio, 0, 1);
  return {
    r: Math.round(startColor.r + (endColor.r - startColor.r) * clampedRatio),
    g: Math.round(startColor.g + (endColor.g - startColor.g) * clampedRatio),
    b: Math.round(startColor.b + (endColor.b - startColor.b) * clampedRatio),
  };
};

const toRgbString = ({ r, g, b }: IRgbColor) => `rgb(${r}, ${g}, ${b})`;

const getGradientColorAtPercent = (
  percent: number,
  startColor: string,
  middleColor: string,
  endColor: string,
) => {
  const start = parseColorToRgb(startColor);
  const middle = parseColorToRgb(middleColor);
  const end = parseColorToRgb(endColor);
  if (!start || !middle || !end) {
    return middleColor;
  }

  const ratio = clamp(percent / 100, 0, 1);
  if (ratio <= 0.5) {
    return toRgbString(interpolateRgb(start, middle, ratio / 0.5));
  }

  return toRgbString(interpolateRgb(middle, end, (ratio - 0.5) / 0.5));
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
    const clamped = clampToRange(value);
    const percent = ((clamped - safeMin) / range) * 100;
    const threshold = clampToRange(thresholdValue);
    const thresholdPct = ((threshold - safeMin) / range) * 100;

    const display = value.toFixed(2);

    return {
      displayValue: display,
      pointerPercent: percent,
      thresholdPercent: thresholdPct,
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
