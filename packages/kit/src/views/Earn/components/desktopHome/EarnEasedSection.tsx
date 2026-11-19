import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_HEIGHT } from '@onekeyhq/components/src/utils/animationConstants';

const SECTION_EASE_MS = 250;
// As the hero's rewards row eases in and out
const SECTION_EASE = ['smooth', { duration: SECTION_EASE_MS }] as [
  'smooth',
  { duration: number },
];

/**
 * A block whose height eases to its content's, so what's below moves
 * smoothly instead of at once. Without an easeKey every change eases (a
 * section that arrives or leaves after the page has drawn). With one, only a
 * change of key eases (one kind of content taking another's place); between
 * changes the block follows its content, whose own motion stays its own
 */
export function EasedSection({
  easeKey,
  children,
}: {
  easeKey?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const easesAlways = easeKey === undefined;
  // The content's last measured height
  const measuredRef = useRef<number | undefined>(undefined);
  // Held while easing; undefined lets the content set the height
  const [height, setHeight] = useState<number>();
  const [isEasing, setIsEasing] = useState(false);
  const keyRef = useRef(easeKey);
  // A new kind of content: hold the old height before it paints, then ease
  // to the new one once measured
  useLayoutEffect(() => {
    if (easesAlways || keyRef.current === easeKey) {
      return;
    }
    keyRef.current = easeKey;
    if (reduceMotion || measuredRef.current === undefined) {
      return;
    }
    setHeight(measuredRef.current);
    setIsEasing(true);
  }, [easeKey, easesAlways, reduceMotion]);
  // Past the ease, the content sets the height again
  useEffect(() => {
    if (!isEasing) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setIsEasing(false);
      setHeight(undefined);
    }, SECTION_EASE_MS + 100);
    return () => clearTimeout(timer);
  }, [isEasing, easeKey]);
  const isEased = !reduceMotion && (easesAlways || isEasing);
  return (
    <YStack
      h={height}
      overflow={easesAlways || isEasing ? 'hidden' : undefined}
      transition={isEased ? SECTION_EASE : undefined}
      animateOnly={ANIMATE_ONLY_HEIGHT}
    >
      <YStack
        onLayout={(event) => {
          const measured = Math.round(event.nativeEvent.layout.height);
          measuredRef.current = measured;
          if (easesAlways || isEasing) {
            setHeight(measured);
          }
        }}
      >
        {children}
      </YStack>
    </YStack>
  );
}
