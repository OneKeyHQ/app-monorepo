import { type ReactNode, useMemo } from 'react';

import Svg, { Circle } from 'react-native-svg';

import { SizableText, XStack, YStack, useTheme } from '@onekeyhq/components';

interface ICircleProgressProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  progressColor?: string;
  trackColor?: string;
  children?: ReactNode;
}

export function CircleProgress({
  percentage,
  size = 64,
  strokeWidth = 4,
  progressColor,
  trackColor,
  children,
}: ICircleProgressProps) {
  const theme = useTheme();
  const defaultProgressColor = theme.textSuccess.val;
  const defaultTrackColor = theme.bgStrong.val;

  const finalProgressColor = progressColor ?? defaultProgressColor;
  const finalTrackColor = trackColor ?? defaultTrackColor;

  // oxlint-disable-next-line @cspell/spellchecker
  const { radius, circumference, strokeDashoffset } = useMemo(() => {
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
    const offset = c * (1 - clampedPercentage / 100);
    return {
      radius: r,
      circumference: c,

      // oxlint-disable-next-line @cspell/spellchecker
      strokeDashoffset: offset,
    };
  }, [size, strokeWidth, percentage]);

  const center = size / 2;
  const percentageText = useMemo(() => {
    return Number.isFinite(percentage) ? percentage.toFixed(2) : '0.00';
  }, [percentage]);

  return (
    <XStack position="relative" width={size} height={size}>
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={finalTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={finalProgressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          // oxlint-disable-next-line @cspell/spellchecker
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      {/* Center label */}
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        alignItems="center"
        justifyContent="center"
      >
        {children ?? (
          <SizableText size="$bodyMdMedium" color="$text">
            {percentageText}%
          </SizableText>
        )}
      </YStack>
    </XStack>
  );
}
