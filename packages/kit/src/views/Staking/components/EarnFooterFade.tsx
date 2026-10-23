import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';

// Set by the deposit modal while its form fades out for the done view. The
// form's footer sits outside the faded body, so it reads this to fade too
export const EarnFormLeavingContext = createContext(false);

/**
 * A form footer's content: it fades out with the form as the done view takes
 * over, and the done view's own footer fades in
 */
export function EarnFooterFade({
  children,
  fadesIn,
}: {
  children: ReactNode;
  // The done view's footer, coming in where the form's left
  fadesIn?: boolean;
}) {
  const isLeaving = useContext(EarnFormLeavingContext);
  const reduceMotion = useReducedMotion();
  const [isShown, setIsShown] = useState(!fadesIn || reduceMotion);
  useEffect(() => {
    if (isShown) {
      return undefined;
    }
    // Two frames, so the hidden first frame is drawn before it fades in
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setIsShown(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [isShown]);
  return (
    <YStack
      opacity={isLeaving || !isShown ? 0 : 1}
      transition="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
    >
      {children}
    </YStack>
  );
}
