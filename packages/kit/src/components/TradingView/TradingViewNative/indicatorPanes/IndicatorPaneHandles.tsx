import { useMemo, useRef, useState } from 'react';

import { Stack } from '@onekeyhq/components';

import {
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_MIN_MAIN_CHART_HEIGHT,
} from '../chartConstants';
import {
  getTradingViewNativeSubIndicatorPaneLayouts,
  getTradingViewNativeSubIndicatorPaneStackLayout,
} from '../utils/subIndicatorRender';

import { PaneDragHandle } from './PaneDragHandle';

import type { useIndicatorPanes } from './useIndicatorPanes';

export function IndicatorPaneHandles({
  controller,
  timeAxisHeight,
}: {
  controller: ReturnType<typeof useIndicatorPanes>;
  timeAxisHeight: number;
}) {
  const [height, setHeight] = useState(0);
  const [moving, setMoving] = useState<{ id: string; delta: number } | null>(
    null,
  );
  const { panes, resize, move, ready } = controller;
  const layouts = useMemo(() => {
    const stack = getTradingViewNativeSubIndicatorPaneStackLayout({
      height,
      paneCount: panes.length,
      panes,
      timeAxisHeight,
    });
    return getTradingViewNativeSubIndicatorPaneLayouts({
      panes,
      stackTop: stack.top,
      stackBottom: stack.bottom,
      startIndex: 0,
      endIndex: 0,
    });
  }, [height, panes, timeAxisHeight]);
  const initial = useRef(layouts);
  const start = () => {
    initial.current = layouts;
  };
  return (
    <Stack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      pointerEvents="box-none"
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
    >
      {ready
        ? layouts.map((layout, index) => (
            <Stack
              key={layout.pane.instanceId}
              pointerEvents="box-none"
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
            >
              <PaneDragHandle
                mode="resize"
                top={layout.top - 5}
                label={`Resize ${layout.pane.shortTitle} pane`}
                testID={`indicator-pane-resize-${layout.pane.indicator}`}
                onStart={start}
                onDrag={(delta, finished, cancelled) => {
                  const before = initial.current;
                  const item = before[index];
                  if (!item) return;
                  const above = before[index - 1];
                  if (item.height < 36 || (above && above.height < 36)) return;
                  const lowerLimit = above
                    ? above.top + 36
                    : TRADING_VIEW_NATIVE_CHART_TOP_PADDING +
                      TRADING_VIEW_NATIVE_SUB_INDICATOR_MIN_MAIN_CHART_HEIGHT;
                  const boundary = cancelled
                    ? item.top
                    : Math.max(
                        lowerLimit,
                        Math.min(item.bottom - 36, item.top + delta),
                      );
                  const heights = Object.fromEntries(
                    before.map((pane) => [pane.pane.instanceId, pane.height]),
                  );
                  heights[item.pane.instanceId] = item.bottom - boundary;
                  if (above)
                    heights[above.pane.instanceId] = boundary - above.top;
                  resize(heights, finished);
                }}
              />
              {layouts.length > 1 ? (
                <PaneDragHandle
                  mode="move"
                  top={
                    layout.top +
                    5 +
                    (moving?.id === layout.pane.instanceId ? moving.delta : 0)
                  }
                  title={layout.pane.shortTitle}
                  label={`Move ${layout.pane.shortTitle} pane up or down`}
                  testID={`indicator-pane-move-${layout.pane.indicator}`}
                  onStart={start}
                  onDrag={(delta, finished, cancelled) => {
                    if (!finished) {
                      setMoving({ id: layout.pane.instanceId, delta });
                      return;
                    }
                    setMoving(null);
                    if (cancelled) return;
                    const before = initial.current;
                    const item = before.find(
                      (pane) => pane.pane.instanceId === layout.pane.instanceId,
                    );
                    if (!item) return;
                    const center = (item.top + item.bottom) / 2 + delta;
                    const target = before.reduce(
                      (closest, pane) =>
                        Math.abs((pane.top + pane.bottom) / 2 - center) <
                        Math.abs((closest.top + closest.bottom) / 2 - center)
                          ? pane
                          : closest,
                      item,
                    );
                    move(item.pane.instanceId, target.pane.instanceId);
                  }}
                />
              ) : null}
            </Stack>
          ))
        : null}
    </Stack>
  );
}
