/**
 * React hook for dual screen info
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  addSpanningListener,
  isDualScreenDevice as checkIsDualScreenDevice,
  isSpanning as checkIsSpanning,
  getHingeBounds as fetchHingeBounds,
  getWindowRects as fetchWindowRects,
} from './DualScreenInfo';
import { CacheResult } from './type';

import type {
  IDualScreenInfoRect,
  ISpanningEvent,
  IUseDualScreenInfoResult,
} from './type';

/**
 * Hook to use dual screen information in React components
 * Automatically subscribes to spanning changes and provides current state
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isDualScreenDevice, isSpanning, windowRects } = useDualScreenInfo();
 *
 *   return (
 *     <View>
 *       <Text>Dual Screen: {isDualScreenDevice ? 'Yes' : 'No'}</Text>
 *       <Text>Spanning: {isSpanning ? 'Yes' : 'No'}</Text>
 *     </View>
 *   );
 * }
 * ```
 */

export const useDualScreenInfo = (): IUseDualScreenInfoResult => {
  const [isDualScreenDevice, setIsDualScreenDevice] = useState(
    CacheResult.isDualScreenDevice,
  );
  const [isSpanning, setIsSpanning] = useState(CacheResult.isSpanning);
  const [windowRects, setWindowRects] = useState<IDualScreenInfoRect[]>([]);
  const [hingeBounds, setHingeBounds] = useState<IDualScreenInfoRect | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [isDualScreen, spanning, rects, hinge] = await Promise.all([
        checkIsDualScreenDevice(),
        checkIsSpanning(),
        fetchWindowRects(),
        fetchHingeBounds(),
      ]);

      setIsDualScreenDevice(isDualScreen);
      setIsSpanning(spanning);
      setWindowRects(rects);
      setHingeBounds(hinge);
    } catch (error) {
      console.warn('useDualScreenInfo refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    void refresh();

    // Subscribe to spanning changes
    const subscription = addSpanningListener((event: ISpanningEvent) => {
      setIsSpanning(event.isSpanning);
      // Refresh window rects and hinge bounds when spanning changes
      void Promise.all([fetchWindowRects(), fetchHingeBounds()]).then(
        ([rects, hinge]) => {
          setWindowRects(rects);
          setHingeBounds(hinge);
        },
      );
    });

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  return useMemo(
    () => ({
      isDualScreenDevice,
      isSpanning,
      windowRects,
      hingeBounds,
      isLoading,
      refresh,
    }),
    [
      isDualScreenDevice,
      isSpanning,
      windowRects,
      hingeBounds,
      isLoading,
      refresh,
    ],
  );
};
