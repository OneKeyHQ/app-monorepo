/**
 * React hook for dual screen info
 */

import { useEffect, useState, useCallback } from 'react';

import type { Rect, SpanningEvent } from './index';
import {
  isDualScreenDevice as checkIsDualScreenDevice,
  isSpanning as checkIsSpanning,
  getWindowRects as fetchWindowRects,
  getHingeBounds as fetchHingeBounds,
  addSpanningListener,
} from './index';

export interface UseDualScreenInfoResult {
  isDualScreenDevice: boolean;
  isSpanning: boolean;
  windowRects: Rect[];
  hingeBounds: Rect | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

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
export function useDualScreenInfo(): UseDualScreenInfoResult {
  const [isDualScreenDevice, setIsDualScreenDevice] = useState(false);
  const [isSpanning, setIsSpanning] = useState(false);
  const [windowRects, setWindowRects] = useState<Rect[]>([]);
  const [hingeBounds, setHingeBounds] = useState<Rect | null>(null);
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
    const subscription = addSpanningListener(
      (event: SpanningEvent) => {
        setIsSpanning(event.isSpanning);
        // Refresh window rects and hinge bounds when spanning changes
        void Promise.all([fetchWindowRects(), fetchHingeBounds()]).then(
          ([rects, hinge]) => {
            setWindowRects(rects);
            setHingeBounds(hinge);
          }
        );
      }
    );

    return () => {
      subscription.remove();
    };
  }, [refresh]);

  return {
    isDualScreenDevice,
    isSpanning,
    windowRects,
    hingeBounds,
    isLoading,
    refresh,
  };
}

