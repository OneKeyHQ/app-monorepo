import { useLayoutEffect, useRef } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import type { IElement } from '@onekeyhq/components';

// The app's 'quick' transition: 150 ms on its ease-out curve
const FADE_MS = 150;
const FADE_EASING = 'cubic-bezier(0.25, 0.1, 0.25, 1)';

/**
 * Fades the element in each time `key` changes: a list laid out again by a
 * filter, a search or a sort, or a tab coming in. It starts in the commit
 * that lays the new content out, so no frame shows it at full strength
 * first. Opacity only, and none under reduced motion. Web only (the desktop
 * home); elsewhere the ref is left alone.
 */
export function useEarnDesktopFadeIn(
  key: string,
  {
    isEnabled = true,
    fadesOnMount = false,
  }: {
    /** Off: the change passes without a fade (a tab going out of view) */
    isEnabled?: boolean;
    /** The first render fades too: content that mounts as it comes in */
    fadesOnMount?: boolean;
  } = {},
) {
  const ref = useRef<IElement>(null);
  const reduceMotion = useReducedMotion();
  const keyRef = useRef<string | undefined>(fadesOnMount ? undefined : key);
  useLayoutEffect(() => {
    if (keyRef.current === key) {
      return;
    }
    keyRef.current = key;
    const element = ref.current;
    if (
      !isEnabled ||
      reduceMotion ||
      typeof HTMLElement === 'undefined' ||
      !(element instanceof HTMLElement)
    ) {
      return;
    }
    element.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: FADE_MS,
      easing: FADE_EASING,
    });
  }, [isEnabled, key, reduceMotion]);
  return ref;
}
