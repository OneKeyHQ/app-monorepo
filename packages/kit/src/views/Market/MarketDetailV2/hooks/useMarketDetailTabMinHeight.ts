import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';

import type { YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useMarketDetailTabMinHeight(identity?: string) {
  const ref = useRef<ComponentRef<typeof YStack>>(null);
  const [minHeight, setMinHeight] = useState(0);
  const scrollCleanupRef = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => {
    setMinHeight(0);
    return () => {
      scrollCleanupRef.current?.();
      scrollCleanupRef.current = undefined;
    };
  }, [identity]);
  const preserveScrollPosition = useCallback(() => {
    if (platformEnv.isNative) return;
    // React Native Web exposes the underlying element through the view ref.
    const element = ref.current as unknown as HTMLElement | null;
    if (!element) return;
    let parent = element.parentElement;
    while (parent) {
      const { overflowY } = globalThis.getComputedStyle(parent);
      if (overflowY === 'auto' || overflowY === 'scroll') {
        // Keep enough content below the tab bar for the current scroll offset
        // to remain reachable when a long overview becomes a short position.
        scrollCleanupRef.current?.();
        const scrollElement = parent;
        const releaseAtTop = () => {
          if (scrollElement.scrollTop === 0) {
            setMinHeight(0);
            scrollCleanupRef.current?.();
            scrollCleanupRef.current = undefined;
          }
        };
        scrollElement.addEventListener('scroll', releaseAtTop);
        scrollCleanupRef.current = () =>
          scrollElement.removeEventListener('scroll', releaseAtTop);
        setMinHeight(
          Math.max(
            0,
            parent.clientHeight -
              (element.getBoundingClientRect().top -
                parent.getBoundingClientRect().top -
                parent.clientTop),
          ),
        );
        return;
      }
      parent = parent.parentElement;
    }
  }, []);
  return { ref, minHeight, preserveScrollPosition };
}
