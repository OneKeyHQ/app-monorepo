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
  const { panes, resize, ready } = controller;
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
            </Stack>
          ))
        : null}
    </Stack>
  );
}
