import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useWindowDimensions } from 'react-native';

import type { IElement } from '@onekeyhq/components';

import { useSpotlightScrollPause } from './useSpotlightScrollPause';

import type { ViewInstance } from 'react-native';

// This opt-in guard measures only on layout/scroll/visibility changes, never
// on a polling interval. Old tours keep their existing visibility behavior.
export function useSpotlightAnchorVisibility(
  triggerRef: RefObject<IElement | null>,
  enabled: boolean,
) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [isVisible, setIsVisible] = useState(false);
  const generationRef = useRef(0);
  const scrollingRef = useRef(false);
  const measure = useCallback(
    (onMeasured?: (visible: boolean) => void) => {
      generationRef.current += 1;
      const generation = generationRef.current;
      if (!enabled || scrollingRef.current) {
        setIsVisible(false);
        onMeasured?.(false);
        return;
      }
      const target = triggerRef.current as ViewInstance | null;
      if (!target) {
        setIsVisible(false);
        onMeasured?.(false);
        return;
      }
      target.measureInWindow((x, y, width, height) => {
        if (generation !== generationRef.current) return;
        const visible =
          width > 0 &&
          height > 0 &&
          x >= 0 &&
          y >= 0 &&
          x + width <= windowWidth &&
          y + height <= windowHeight;
        setIsVisible(visible);
        onMeasured?.(visible);
      });
    },
    [enabled, triggerRef, windowHeight, windowWidth],
  );
  const onScrollChange = useCallback(
    (scrolling: boolean) => {
      scrollingRef.current = scrolling;
      if (scrolling) {
        generationRef.current += 1;
        setIsVisible(false);
      } else {
        measure();
      }
    },
    [measure],
  );
  useSpotlightScrollPause(triggerRef, enabled, onScrollChange);
  useEffect(() => {
    measure();
    return () => {
      generationRef.current += 1;
      scrollingRef.current = false;
    };
  }, [measure]);

  return { isAnchorVisible: isVisible, measureAnchor: measure };
}
