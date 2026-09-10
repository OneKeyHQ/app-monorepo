import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
} from 'react';

import { useWindowDimensions } from 'react-native';

import { Stack, useTheme } from '@onekeyhq/components';
import { useMarketDesktopLayoutAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { makeTimeoutPromise } from '@onekeyhq/shared/src/background/backgroundUtils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { MARKET_DESKTOP_CHART_MIN_HEIGHT } from '../../../marketDesktopLayoutConstants';

const MARKET_DESKTOP_CHART_VIEWPORT_GUTTER = 160;
const MARKET_DESKTOP_CHART_KEYBOARD_STEP = 24;
const MARKET_DESKTOP_CHART_SAVE_TIMEOUT = 5000;

function clampChartHeight(height: number, maxHeight: number) {
  return Math.min(
    Math.max(Math.round(height), MARKET_DESKTOP_CHART_MIN_HEIGHT),
    maxHeight,
  );
}

export function MarketDesktopChartContainer({
  children,
  fullscreenStyle,
  fullscreenZIndex,
  isFullscreen,
  testID,
}: {
  children: ReactNode;
  fullscreenStyle?: CSSProperties;
  fullscreenZIndex?: number;
  isFullscreen: boolean;
  testID: string;
}) {
  const theme = useTheme();
  const { height: viewportHeight } = useWindowDimensions();
  const maxHeight = Math.max(
    MARKET_DESKTOP_CHART_MIN_HEIGHT,
    Math.floor(viewportHeight - MARKET_DESKTOP_CHART_VIEWPORT_GUTTER),
  );
  const [layoutState, setLayoutState] = useMarketDesktopLayoutAtom();
  const [dragHeight, setDragHeight] = useState<number>();
  const [pendingSave, setPendingSave] = useState<{
    id: string;
    height: number;
  }>();
  const pendingSaveRef = useRef(pendingSave);
  const latestSaveRef = useRef(pendingSave);
  const acknowledgementTimerRef =
    useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveQueueRef = useRef(Promise.resolve());
  const isMountedRef = useRef(true);
  const savedHeight = layoutState.chartHeight;
  const chartHeight = clampChartHeight(
    dragHeight ??
      pendingSave?.height ??
      (typeof savedHeight === 'number' && Number.isFinite(savedHeight)
        ? savedHeight
        : MARKET_DESKTOP_CHART_MIN_HEIGHT),
    maxHeight,
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<
    | {
        pointerId: number;
        startHeight: number;
        currentHeight: number;
        startY: number;
      }
    | undefined
  >(undefined);

  const clearPendingSave = useCallback((id: string) => {
    if (pendingSaveRef.current?.id !== id) {
      return;
    }
    clearTimeout(acknowledgementTimerRef.current);
    pendingSaveRef.current = undefined;
    if (isMountedRef.current) {
      setPendingSave(undefined);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimeout(acknowledgementTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // A matching height alone can be the stale mirror of a return-to-start save.
    if (
      pendingSave &&
      layoutState.chartHeightUpdateId === pendingSave.id &&
      savedHeight === pendingSave.height
    ) {
      clearPendingSave(pendingSave.id);
    }
  }, [
    clearPendingSave,
    layoutState.chartHeightUpdateId,
    pendingSave,
    savedHeight,
  ]);

  const saveHeight = useCallback(
    function enqueueSave(height: number) {
      const request = { id: generateUUID(), height };
      latestSaveRef.current = request;
      pendingSaveRef.current = request;
      clearTimeout(acknowledgementTimerRef.current);
      if (isMountedRef.current) {
        setPendingSave(request);
      }
      // Coalesce queued inputs, but keep a bound on an unresponsive bridge.
      saveQueueRef.current = saveQueueRef.current.then(() => {
        if (latestSaveRef.current !== request) {
          return undefined;
        }
        let timedOut = false;
        return makeTimeoutPromise({
          asyncFunc: async () => {
            await Promise.resolve(
              setLayoutState((prev) => ({
                ...prev,
                chartHeight: height,
                chartHeightUpdateId: request.id,
              })),
            );
            // A timeout releases the queue, not the original write. Repair a
            // late write even after unmount so the latest preference wins.
            const latest = latestSaveRef.current;
            if (timedOut && latest && latest !== request) {
              enqueueSave(latest.height);
            }
          },
          timeout: MARKET_DESKTOP_CHART_SAVE_TIMEOUT,
          onTimeout: () => {
            timedOut = true;
          },
          timeoutRejectError: new OneKeyLocalError(
            'Chart height save timed out',
          ),
        })(undefined).then(
          () => {
            // RPC completion can precede the UI broadcast. Keep the overlay
            // until that acknowledgement, with a bound for a lost broadcast.
            if (
              isMountedRef.current &&
              pendingSaveRef.current?.id === request.id
            ) {
              acknowledgementTimerRef.current = setTimeout(
                () => clearPendingSave(request.id),
                MARKET_DESKTOP_CHART_SAVE_TIMEOUT,
              );
            }
          },
          () => clearPendingSave(request.id),
        );
      });
    },
    [clearPendingSave, setLayoutState],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.currentTarget.focus();
      dragStateRef.current = {
        pointerId: event.pointerId,
        startHeight: chartHeight,
        currentHeight: chartHeight,
        startY: event.clientY,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        dragStateRef.current = undefined;
        return;
      }
      setIsDragging(true);
    },
    [chartHeight],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      dragState.currentHeight = clampChartHeight(
        dragState.startHeight + event.clientY - dragState.startY,
        maxHeight,
      );
      setDragHeight(dragState.currentHeight);
    },
    [maxHeight],
  );

  const finishPointerDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      if (dragState.currentHeight !== dragState.startHeight) {
        saveHeight(clampChartHeight(dragState.currentHeight, maxHeight));
      }
      dragStateRef.current = undefined;
      setDragHeight(undefined);
      setIsDragging(false);
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    },
    [maxHeight, saveHeight],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      let nextHeight: number | undefined;
      if (event.key === 'ArrowDown') {
        nextHeight = chartHeight + MARKET_DESKTOP_CHART_KEYBOARD_STEP;
      } else if (event.key === 'ArrowUp') {
        nextHeight = chartHeight - MARKET_DESKTOP_CHART_KEYBOARD_STEP;
      } else if (event.key === 'Home') {
        nextHeight = MARKET_DESKTOP_CHART_MIN_HEIGHT;
      }
      if (nextHeight === undefined) {
        return;
      }
      event.preventDefault();
      const clampedHeight = clampChartHeight(nextHeight, maxHeight);
      if (event.key !== 'Home' && clampedHeight === chartHeight) {
        return;
      }
      saveHeight(clampedHeight);
    },
    [chartHeight, maxHeight, saveHeight],
  );

  const resizeHandleStyle = useMemo<CSSProperties>(
    () => ({
      alignItems: 'center',
      bottom: -6,
      cursor: 'row-resize',
      display: 'flex',
      height: 12,
      justifyContent: 'center',
      left: 0,
      outline: 'none',
      position: 'absolute',
      right: 0,
      touchAction: 'none',
      userSelect: 'none',
      zIndex: 2,
    }),
    [],
  );

  return (
    <Stack
      testID={testID}
      width="100%"
      height={isFullscreen ? undefined : chartHeight}
      flex={isFullscreen ? 1 : undefined}
      position="relative"
      bg="$bgApp"
      zIndex={isFullscreen ? fullscreenZIndex : undefined}
      style={isFullscreen ? fullscreenStyle : undefined}
    >
      <Stack flex={1} minHeight={0} overflow="hidden">
        {children}
      </Stack>

      {isFullscreen ? null : (
        <div
          data-testid={`${testID}-resize-handle`}
          role="separator"
          aria-label="Resize chart"
          aria-orientation="horizontal"
          aria-valuemin={MARKET_DESKTOP_CHART_MIN_HEIGHT}
          aria-valuemax={maxHeight}
          aria-valuenow={chartHeight}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onLostPointerCapture={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          style={resizeHandleStyle}
        >
          <div
            style={{
              backgroundColor: isDragging
                ? theme.borderActive.val
                : theme.borderSubdued.val,
              height: 1,
              width: '100%',
            }}
          />
        </div>
      )}

      {isDragging ? (
        <div
          data-testid={`${testID}-resize-shield`}
          style={{
            cursor: 'row-resize',
            inset: 0,
            position: 'fixed',
            zIndex: 1,
          }}
        />
      ) : null}
    </Stack>
  );
}
