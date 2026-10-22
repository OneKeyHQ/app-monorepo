import { memo } from 'react';
import type { ReactNode } from 'react';

import { SizableText, XStack, YStack } from '@onekeyhq/components';

export const LEVERAGE_TICK_SPACING = 14;
export const LEVERAGE_RULER_HEIGHT = 104;
export const LEVERAGE_TICK_WIDTH = 1.5;
export const LEVERAGE_TICK_HEIGHT = 32;
export const LEVERAGE_FOCUSED_TICK_HEIGHT = 64;
export const LEVERAGE_TICK_TOP = 8;
export const LEVERAGE_SETTLE_DURATION = 240;

export interface ILeverageRulerProps {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  accessibilityLabel: string;
}

export function clampLeverage(value: number, max: number) {
  'worklet';
  return Math.max(1, Math.min(max, Math.round(value)));
}

export function getRulerPosition(value: number, max: number) {
  'worklet';
  const clamped = Math.max(1, Math.min(max, value));
  // Limit overscroll to 12 points while keeping the selected value in range.
  return clamped + Math.max(-12, Math.min(12, (value - clamped) * 2.8)) / 14;
}

export function getRulerTickProgress(position: number, tick: number) {
  'worklet';
  const proximity = Math.max(0, 1 - Math.abs(position - tick) / 1.6);
  return proximity * proximity * (3 - 2 * proximity);
}

export function getRulerReleaseTarget(
  position: number,
  velocityX: number,
  max: number,
) {
  'worklet';
  // Project a short glide, capped at three ticks so precise adjustments stay easy.
  const travel =
    Math.abs(velocityX) < 80
      ? 0
      : Math.max(-3, Math.min(3, (-velocityX * 0.08) / LEVERAGE_TICK_SPACING));
  return clampLeverage(position + travel, max);
}

export const LeverageRulerScale = memo(
  ({
    max,
    renderTick,
  }: {
    max: number;
    renderTick: (leverage: number, major: boolean) => ReactNode;
  }) => (
    <XStack
      width={(max - 1) * LEVERAGE_TICK_SPACING + 1}
      height={LEVERAGE_RULER_HEIGHT}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: max }, (_, index) => {
        const leverage = index + 1;
        const major = leverage === 1 || leverage === max || leverage % 5 === 0;
        return (
          <YStack
            key={leverage}
            position="absolute"
            left={index * LEVERAGE_TICK_SPACING - 20}
            width={40}
            alignItems="center"
            top={LEVERAGE_TICK_TOP}
            gap="$2"
          >
            <YStack
              width={LEVERAGE_TICK_WIDTH}
              height={LEVERAGE_FOCUSED_TICK_HEIGHT}
              justifyContent="flex-end"
            >
              {renderTick(leverage, major)}
            </YStack>
            {major ? (
              <SizableText size="$bodyXs" color="$textSubdued">
                {leverage}
              </SizableText>
            ) : null}
          </YStack>
        );
      })}
    </XStack>
  ),
);
LeverageRulerScale.displayName = 'LeverageRulerScale';
