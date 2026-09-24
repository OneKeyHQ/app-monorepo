import { useCallback, useEffect } from 'react';
import type { MouseEvent, PointerEvent, RefObject } from 'react';

import { useChartDrawings as useSharedChartDrawings } from '../../drawings/useChartDrawings';

import { drawChartDrawings } from './geometry';

import type { IDrawingProjection } from './model';
import type { IDrawingPointerEvent } from '../../drawings/useChartDrawings';

function drawingEvent(
  event: MouseEvent<HTMLCanvasElement>,
): IDrawingPointerEvent {
  const canvas = event.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const pointerId =
    'pointerId' in event && typeof event.pointerId === 'number'
      ? event.pointerId
      : 1;
  return {
    type: event.type,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    pointerId,
    button: event.button,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    focus: () => canvas.focus({ preventScroll: true }),
    capture: () => canvas.setPointerCapture(pointerId),
    release: () => {
      if (canvas.hasPointerCapture(pointerId))
        canvas.releasePointerCapture(pointerId);
    },
    setCursor: (cursor) => {
      canvas.style.cursor = cursor;
    },
    preventDefault: () => event.preventDefault(),
  };
}

export function useChartDrawings(
  options: Parameters<typeof useSharedChartDrawings>[0] & {
    rootRef: RefObject<HTMLDivElement | null>;
  },
) {
  const controller = useSharedChartDrawings(options);
  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onDoubleClick,
    onKeyDown,
    getRenderState,
  } = controller;
  const pointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) =>
      onPointerDown(drawingEvent(event)),
    [onPointerDown],
  );
  const pointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) =>
      onPointerMove(drawingEvent(event)),
    [onPointerMove],
  );
  const pointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) =>
      onPointerUp(drawingEvent(event)),
    [onPointerUp],
  );
  const doubleClick = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) =>
      onDoubleClick(drawingEvent(event)),
    [onDoubleClick],
  );
  const { enabled, rootRef } = options;
  useEffect(() => {
    if (!enabled) return undefined;
    const handle = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      const root = rootRef.current;
      if (
        root &&
        (root.contains(document.activeElement) || root.matches(':hover'))
      )
        onKeyDown(event);
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [enabled, onKeyDown, rootRef]);
  const draw = useCallback(
    (
      context: CanvasRenderingContext2D,
      projection: IDrawingProjection,
      background: string,
    ) => {
      const state = getRenderState();
      drawChartDrawings(
        context,
        state.drawings,
        projection,
        state.selectedId,
        background,
        state.selectedIds,
      );
    },
    [getRenderState],
  );
  return {
    ...controller,
    draw,
    onPointerDown: pointerDown,
    onPointerMove: pointerMove,
    onPointerUp: pointerUp,
    onDoubleClick: doubleClick,
  };
}

export type IChartDrawingsController = ReturnType<typeof useChartDrawings>;
