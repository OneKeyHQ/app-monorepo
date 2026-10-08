import { useCallback, useLayoutEffect, useRef } from 'react';

export function useTradingViewNativeCanvasRender(draw: () => void) {
  const drawRef = useRef(draw);
  const frameRef = useRef<number | undefined>(undefined);
  const requestRender = useCallback(() => {
    if (frameRef.current !== undefined) {
      return;
    }
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined;
      drawRef.current();
    });
  }, []);

  useLayoutEffect(() => {
    drawRef.current = draw;
    requestRender();
  }, [draw, requestRender]);

  useLayoutEffect(
    () => () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = undefined;
      }
    },
    [],
  );

  return requestRender;
}
