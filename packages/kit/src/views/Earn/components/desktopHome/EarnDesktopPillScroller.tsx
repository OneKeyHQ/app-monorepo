import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { ScrollView, YStack } from '@onekeyhq/components';

// How far an edge with pills past it fades into the page
const EDGE_FADE = 24;

/**
 * A phone-width row of pills that scrolls sideways, edge to edge. An edge
 * with pills past it fades out into the page, so the row reads as one that
 * scrolls rather than a pill cut short. The fade is a mask, so it takes the
 * page's color in either theme.
 */
export function EarnDesktopPillScroller({
  children,
  gap,
}: {
  children: ReactNode;
  gap?: '$2';
}) {
  const [edges, setEdges] = useState({ start: false, end: false });
  const metricsRef = useRef({ width: 0, contentWidth: 0, x: 0 });
  const update = useCallback(() => {
    const { width, contentWidth, x } = metricsRef.current;
    const start = x > 1;
    const end = x + width < contentWidth - 1;
    setEdges((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, []);
  const mask = `linear-gradient(to right, ${
    edges.start ? 'transparent' : '#000'
  }, #000 ${EDGE_FADE}px, #000 calc(100% - ${EDGE_FADE}px), ${
    edges.end ? 'transparent' : '#000'
  })`;
  return (
    <YStack
      mx="$-5"
      w="100%"
      flexGrow={1}
      style={{ WebkitMaskImage: mask, maskImage: mask }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        w="100%"
        contentContainerStyle={{ px: '$5', gap }}
        scrollEventThrottle={16}
        onLayout={(event) => {
          metricsRef.current.width = event.nativeEvent.layout.width;
          update();
        }}
        onContentSizeChange={(contentWidth) => {
          metricsRef.current.contentWidth = contentWidth;
          update();
        }}
        onScroll={(event) => {
          metricsRef.current.x = event.nativeEvent.contentOffset.x;
          update();
        }}
      >
        {children}
      </ScrollView>
    </YStack>
  );
}
