import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// 16 px under the top, as the Market detail page's trade column
const STICKY_GAP = 16;
// The form's least width, about a phone's: the window's first wide sizes
// (768 to 900 px) would leave it under 240 px at 35%
const FORM_MIN_WIDTH = 360;

function findScrollArea(node: HTMLElement) {
  let parent = node.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

/**
 * The wide details page's form column: it stays in view as the details on
 * the left scroll. A form taller than the space moves with the page, up or
 * down, until its bottom or top shows, then stays. Growing (a list opening
 * in it) doesn't move it: the rest shows as the page scrolls
 */
export function StickyFormColumn({ children }: { children: ReactNode }) {
  const [column, setColumn] = useState<HTMLElement | null>(null);
  const columnRef = useCallback((node: IElement | null) => {
    setColumn(node as unknown as HTMLElement | null);
  }, []);

  useEffect(() => {
    if (!column || !platformEnv.isRuntimeBrowser) {
      return undefined;
    }
    const area = findScrollArea(column);
    if (!area) {
      return undefined;
    }
    // Set on the element, not through a render: it follows every scroll
    let top = STICKY_GAP;
    let lastScrollTop = area.scrollTop;
    const place = (next: number) => {
      // As high as it goes: its bottom 16 px over the window's
      const highest = Math.min(
        STICKY_GAP,
        area.clientHeight - column.offsetHeight - STICKY_GAP,
      );
      const placed = Math.max(highest, Math.min(STICKY_GAP, next));
      if (placed !== top) {
        top = placed;
        column.style.top = `${top}px`;
      }
    };
    const handleScroll = () => {
      const delta = area.scrollTop - lastScrollTop;
      lastScrollTop = area.scrollTop;
      place(top - delta);
    };
    const observer = new ResizeObserver(() => place(top));
    observer.observe(column);
    observer.observe(area);
    area.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      observer.disconnect();
      area.removeEventListener('scroll', handleScroll);
    };
  }, [column]);

  // React Native has no sticky position: a wide native screen (a tablet)
  // keeps the column as it was
  if (platformEnv.isNative) {
    return (
      <Stack width="35%" minWidth={FORM_MIN_WIDTH} flexShrink={0}>
        {children}
      </Stack>
    );
  }
  return (
    <Stack
      ref={columnRef}
      width="35%"
      minWidth={FORM_MIN_WIDTH}
      flexShrink={0}
      // Its own height, not the row's, so it has room to stay in view
      alignSelf="flex-start"
      position="sticky"
      top={STICKY_GAP}
    >
      {children}
    </Stack>
  );
}
