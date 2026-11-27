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

// A field, e.g. a drawing's name, keeps the keys typed into it.
export function isEditableKeyTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

type IChartRoots = ReadonlyArray<RefObject<HTMLDivElement | null>>;

// Roots of the charts with drawing tools, so a key press reaches one of them.
const chartRoots = new Set<IChartRoots>();

export function useChartDrawings(
  options: Parameters<typeof useSharedChartDrawings>[0] & {
    rootRef: RefObject<HTMLDivElement | null>;
    /**
     * The chart's drawing tools when they are not inside `rootRef`, e.g. the
     * column a split view shows at the left of all its charts.
     */
    toolsRef?: RefObject<HTMLDivElement | null>;
    /**
     * False while the chart's tools are off screen, e.g. in a chart of a split
     * view that is not selected. Its root then takes no key and does not hold
     * a key back from the chart that has its tools on screen.
     */
    takesKeys?: boolean;
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
  const { enabled, rootRef, takesKeys = true, toolsRef } = options;
  useEffect(() => {
    if (!enabled || !takesKeys) return undefined;
    const roots: IChartRoots = toolsRef ? [rootRef, toolsRef] : [rootRef];
    chartRoots.add(roots);
    const handle = (event: KeyboardEvent) => {
      if (isEditableKeyTarget(event.target) || !rootRef.current) return;
      // With several charts on screen the key goes to the one under the
      // pointer; a focused chart only takes it when the pointer is over none.
      const isHovered = (chart: IChartRoots) =>
        chart.some((ref) => Boolean(ref.current?.matches(':hover')));
      const isFocused = roots.some((ref) =>
        Boolean(ref.current?.contains(document.activeElement)),
      );
      if (isHovered(roots) || (isFocused && ![...chartRoots].some(isHovered)))
        onKeyDown(event);
    };
    document.addEventListener('keydown', handle);
    return () => {
      chartRoots.delete(roots);
      document.removeEventListener('keydown', handle);
    };
  }, [enabled, onKeyDown, rootRef, takesKeys, toolsRef]);
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
