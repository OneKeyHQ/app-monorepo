import { useEffect, useState } from 'react';

import { YStack } from '@onekeyhq/components';
import type { IYStackProps } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';

const FADE_IN = { opacity: 0 } as const;
// A little longer than the 'quick' fade, so it ends before the placeholder
// goes
const LEAVE_MS = 220;

/**
 * A placeholder over a figure's place while the figure is on its way. It
 * fades out by its own opacity and goes once faded: a fade done by leaving
 * (exitStyle) is cut short when the form renders again as it starts, which
 * it does as the figures come in
 */
export function EarnFadingPlaceholder({
  visible,
  children,
  ...props
}: { visible: boolean } & IYStackProps) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    setIsLeaving(!visible);
  }
  useEffect(() => {
    if (!isLeaving) {
      return undefined;
    }
    const timer = setTimeout(() => setIsLeaving(false), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [isLeaving]);
  if (!visible && !isLeaving) {
    return null;
  }
  return (
    <YStack
      position="absolute"
      right={0}
      top={0}
      jc="center"
      pointerEvents="none"
      aria-hidden
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
      enterStyle={FADE_IN}
      opacity={visible ? 1 : 0}
      {...props}
    >
      {children}
    </YStack>
  );
}
