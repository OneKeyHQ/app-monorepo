import { memo } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import {
  AnimatePresence,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';

import type { LayoutChangeEvent } from 'react-native';

// The small digits' size against the total's
const SIZE_RATIO = 0.5;
// How far a digit travels as it turns, against its own size
const TURN_RATIO = 0.45;

function BasicEarnTickingDigits({
  digits,
  fontSize,
  isStatic,
  onLayout,
}: {
  digits: string;
  // The total's size: the digits take a share of it
  fontSize: number;
  // Drawn without motion, for the copy that is only measured
  isStatic?: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const reduceMotion = useReducedMotion();
  const size = Math.round(fontSize * SIZE_RATIO);
  const turn = Math.round(size * TURN_RATIO);
  const textProps = {
    fontSize: size,
    lineHeight: size,
    fontWeight: 500,
    color: '$textDisabled',
  } as const;
  if (!digits) {
    return null;
  }
  return (
    <XStack ai="baseline" flexShrink={0} onLayout={onLayout} aria-hidden>
      {digits.split('').map((digit, index) =>
        isStatic || reduceMotion ? (
          // eslint-disable-next-line react/no-array-index-key
          <SizableText key={index} {...textProps}>
            {digit}
          </SizableText>
        ) : (
          // A place keeps its width whatever digit is in it (tabular figures),
          // from an unseen digit; the one shown lies over it, and a new one
          // comes up from below as the old one leaves upward
          // eslint-disable-next-line react/no-array-index-key
          <YStack key={index}>
            <SizableText {...textProps} opacity={0}>
              0
            </SizableText>
            <AnimatePresence initial={false}>
              <YStack
                key={digit}
                position="absolute"
                t={0}
                l={0}
                transition="quick"
                animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
                enterStyle={{ opacity: 0, y: turn }}
                exitStyle={{ opacity: 0, y: -turn }}
              >
                <SizableText {...textProps}>{digit}</SizableText>
              </YStack>
            </AnimatePresence>
          </YStack>
        ),
      )}
    </XStack>
  );
}

/**
 * The digits after a total's cents, smaller and dimmer: as many as it takes
 * for the last one to move about once a second, each turning like an
 * odometer's as it changes
 */
export const EarnTickingDigits = memo(BasicEarnTickingDigits);
