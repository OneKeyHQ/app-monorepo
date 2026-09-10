import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
} from 'react';

import { useWindowDimensions } from 'react-native';

import { Stack, YStack, useTheme } from '@onekeyhq/components';

import { MARKET_DESKTOP_CHART_MIN_HEIGHT } from '../../../marketDesktopLayoutConstants';

const MARKET_DESKTOP_CHART_VIEWPORT_GUTTER = 160;
const MARKET_DESKTOP_CHART_KEYBOARD_STEP = 24;

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
  footer,
  testID = 'market-desktop-chart',
}: {
  children: ReactNode;
  fullscreenStyle?: CSSProperties;
  fullscreenZIndex?: number;
  isFullscreen: boolean;
  // Rendered under the resize handle, outside the resizable box. The handle's
  // line has to sit on the box's own clipping edge to read as the cut it makes
  // while dragging, so anything that belongs below it lives out here.
  footer?: ReactNode;
  // Defaulted rather than required: the handle and the drag shield derive
  // their own ids from it, so a caller that has no need to name the container
  // must not leave them reading `undefined-resize-handle`.
  testID?: string;
}) {
  const theme = useTheme();
  const { height: viewportHeight } = useWindowDimensions();
  const maxHeight = Math.max(
    MARKET_DESKTOP_CHART_MIN_HEIGHT,
    Math.floor(viewportHeight - MARKET_DESKTOP_CHART_VIEWPORT_GUTTER),
  );
  const [chartHeight, setChartHeight] = useState(
    MARKET_DESKTOP_CHART_MIN_HEIGHT,
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<
    | {
        pointerId: number;
        startHeight: number;
        startY: number;
      }
    | undefined
  >(undefined);

  useEffect(() => {
    setChartHeight((height) => clampChartHeight(height, maxHeight));
  }, [maxHeight]);

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
      setChartHeight(
        clampChartHeight(
          dragState.startHeight + event.clientY - dragState.startY,
          maxHeight,
        ),
      );
    },
    [maxHeight],
  );

  const finishPointerDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      dragStateRef.current = undefined;
      setIsDragging(false);
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    },
    [],
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
      setChartHeight(clampChartHeight(nextHeight, maxHeight));
    },
    [chartHeight, maxHeight],
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

  const box = (
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

  // The wrapper is unconditional: returning `box` bare in fullscreen changes
  // the element the chart hangs off, which remounts the whole subtree and
  // costs the user their zoom and pan every time they toggle. Fullscreen drops
  // the footer instead, and the box keeps carrying the frame styles itself.
  return (
    <YStack width="100%" gap="$2">
      {box}
      {isFullscreen ? null : footer}
    </YStack>
  );
}
