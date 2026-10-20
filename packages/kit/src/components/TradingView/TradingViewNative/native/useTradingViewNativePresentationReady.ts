import { useCallback, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { noop } from 'lodash';

import type { ITradingViewNativeChartSize } from './chartRuntime';
import type { CanvasRef } from '@shopify/react-native-skia';

export function useTradingViewNativePresentationReady(
  canvasRef: RefObject<CanvasRef | null>,
  onReady?: (size: ITradingViewNativeChartSize) => void,
) {
  const mounted = useRef(true);
  const requestId = useRef(0);
  const readyCallback = useRef(onReady);
  useLayoutEffect(() => {
    readyCallback.current = onReady;
    requestId.current += 1;
  }, [onReady]);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  return useCallback(
    (size: ITradingViewNativeChartSize) => {
      const canvas = canvasRef.current;
      const callback = readyCallback.current;
      if (!mounted.current || !canvas || !callback) return;
      requestId.current += 1;
      const request = requestId.current;
      // Layout alone does not mean the native canvas surface has drawn yet.
      void canvas
        .makeImageSnapshotAsync()
        .then((image) => {
          image.dispose();
          if (
            mounted.current &&
            requestId.current === request &&
            // The canvas recreates the imperative handle on each React render.
            canvasRef.current?.getNativeId() === canvas.getNativeId()
          ) {
            canvas.redraw();
            callback(size);
          }
        })
        .catch(noop);
    },
    [canvasRef],
  );
}
