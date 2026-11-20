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

import { getIndicatorPaneResizeHeights } from './model';
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
  const { panes, resize, snapshot, restore, resetHeights, ready } = controller;
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
  const initial = useRef({ layouts, preferences: snapshot() });
  const start = () => {
    initial.current = { layouts, preferences: snapshot() };
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
                onReset={resetHeights}
                onDrag={(delta, finished, cancelled) => {
                  if (cancelled) {
                    // Nothing was resized, so nothing becomes a saved height.
                    restore(initial.current.preferences);
                    return;
                  }
                  const heights = getIndicatorPaneResizeHeights({
                    delta,
                    index,
                    minimumTop:
                      TRADING_VIEW_NATIVE_CHART_TOP_PADDING +
                      TRADING_VIEW_NATIVE_SUB_INDICATOR_MIN_MAIN_CHART_HEIGHT,
                    panes: initial.current.layouts.map((item) => ({
                      id: item.pane.instanceId,
                      top: item.top,
                      bottom: item.bottom,
                      height: item.height,
                    })),
                  });
                  if (heights) resize(heights, finished);
                }}
              />
            </Stack>
          ))
        : null}
    </Stack>
  );
}
