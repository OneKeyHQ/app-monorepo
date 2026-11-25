import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';

import type { IDimensions2D } from '../../utils/multiQrSymbols';

const FOCUS_BOX_SIZE = 73;
const FOCUS_SHRINK_MS = 200;
const FOCUS_HOLD_MS = 800;

export type IDomFocusPoint = {
  x: number;
  y: number;
  normalizedX: number;
  normalizedY: number;
};

export function readDomFocusPoint(
  event: MouseEvent<HTMLElement>,
  frame: IDimensions2D,
): IDomFocusPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  const width = rect.width || event.currentTarget.clientWidth || 0;
  const height = rect.height || event.currentTarget.clientHeight || 0;
  const x = width > 0 ? event.clientX - rect.left : FOCUS_BOX_SIZE / 2;
  const y = height > 0 ? event.clientY - rect.top : FOCUS_BOX_SIZE / 2;
  const scale =
    frame.width > 0 && frame.height > 0
      ? Math.max(width / frame.width, height / frame.height)
      : 0;
  const renderedWidth = scale ? frame.width * scale : width;
  const renderedHeight = scale ? frame.height * scale : height;
  return {
    x,
    y,
    normalizedX:
      width > 0
        ? Math.min(
            1,
            Math.max(0, (x + (renderedWidth - width) / 2) / renderedWidth),
          )
        : 0.5,
    normalizedY:
      height > 0
        ? Math.min(
            1,
            Math.max(0, (y + (renderedHeight - height) / 2) / renderedHeight),
          )
        : 0.5,
  };
}

export function useDomFocusBox() {
  const [box, setBox] = useState<{
    x: number;
    y: number;
    phase: 'initial' | 'active' | 'fading';
    key: number;
  }>();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const requestVersion = useRef(0);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(
    () => () => {
      requestVersion.current += 1;
      clearTimers();
    },
    [clearTimers],
  );

  const resetFocusBox = useCallback(() => {
    requestVersion.current += 1;
    clearTimers();
    setBox(undefined);
  }, [clearTimers]);

  const showFocusBox = useCallback(
    (point: { x: number; y: number }) => {
      clearTimers();
      setBox((previous) => ({
        x: point.x,
        y: point.y,
        phase: 'initial',
        key: (previous?.key ?? 0) + 1,
      }));
      timers.current.push(
        setTimeout(() => {
          setBox((current) =>
            current ? { ...current, phase: 'active' } : undefined,
          );
        }, 16),
        setTimeout(() => {
          setBox((current) =>
            current ? { ...current, phase: 'fading' } : undefined,
          );
        }, FOCUS_SHRINK_MS + FOCUS_HOLD_MS),
        setTimeout(
          () => {
            setBox(undefined);
          },
          FOCUS_SHRINK_MS + FOCUS_HOLD_MS + FOCUS_SHRINK_MS,
        ),
      );
    },
    [clearTimers],
  );

  const requestFocus = useCallback(
    (point: IDomFocusPoint, focus: () => Promise<boolean>) => {
      requestVersion.current += 1;
      const version = requestVersion.current;
      void focus()
        .then((focused) => {
          if (focused && version === requestVersion.current)
            showFocusBox(point);
        })
        .catch(() => {});
    },
    [showFocusBox],
  );

  const focusBoxElement = box
    ? createElement('div', {
        'key': box.key,
        'data-testid': 'scan-camera-focus-box',
        'style': {
          position: 'absolute',
          left: box.x - FOCUS_BOX_SIZE / 2,
          top: box.y - FOCUS_BOX_SIZE / 2,
          width: FOCUS_BOX_SIZE,
          height: FOCUS_BOX_SIZE,
          border: '1px solid #FFFF00',
          boxSizing: 'border-box',
          pointerEvents: 'none',
          opacity: box.phase === 'active' ? 1 : 0,
          transform: box.phase === 'initial' ? 'scale(2)' : 'scale(1)',
          transition: `transform ${FOCUS_SHRINK_MS}ms ease-out, opacity ${FOCUS_SHRINK_MS}ms ease-out`,
        },
      })
    : null;

  return { requestFocus, resetFocusBox, focusBoxElement };
}
