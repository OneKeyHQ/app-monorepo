import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { Stack } from '@onekeyhq/components';
import type { IElement } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// 16 px under the top, as the Market detail page's trade column
const STICKY_GAP = 16;

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
 * the left scroll. A form taller than the space scrolls with the page until
 * its bottom shows, then stays
 */
export function StickyFormColumn({ children }: { children: ReactNode }) {
  const [column, setColumn] = useState<HTMLElement | null>(null);
  const [top, setTop] = useState(STICKY_GAP);
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
    const update = () => {
      setTop(
        Math.min(
          STICKY_GAP,
          area.clientHeight - column.offsetHeight - STICKY_GAP,
        ),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(column);
    observer.observe(area);
    return () => observer.disconnect();
  }, [column]);

  return (
    <Stack
      ref={columnRef}
      width="35%"
      // Its own height, not the row's, so it has room to stay in view
      alignSelf="flex-start"
      position="sticky"
      top={top}
    >
      {children}
    </Stack>
  );
}
