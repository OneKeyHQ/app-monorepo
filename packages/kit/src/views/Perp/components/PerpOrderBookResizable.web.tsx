import { useEffect, useMemo, useRef, useState } from 'react';

import { debounce } from 'lodash';

import { YStack } from '@onekeyhq/components';

import { PerpOrderBook } from './PerpOrderBook';

const ORDERBOOK_LAYOUT = {
  tableHeaderHeight: 24,
  midPriceRowHeight: 24,
  bottomPadding: 0,
  levelRowHeight: 25,
} as const;

function calculateMaxLevelsPerSide(containerHeight: number): number {
  if (containerHeight <= 0) return 11;

  const fixedHeights =
    ORDERBOOK_LAYOUT.tableHeaderHeight +
    ORDERBOOK_LAYOUT.midPriceRowHeight +
    ORDERBOOK_LAYOUT.bottomPadding;

  const availableHeight = containerHeight - fixedHeights;
  const totalRows = Math.floor(
    availableHeight / ORDERBOOK_LAYOUT.levelRowHeight,
  );
  const levelsPerSide = Math.floor(totalRows / 2);

  return Math.max(3, Math.min(levelsPerSide, 50));
}

function PerpOrderBookResizable() {
  const containerRef = useRef<HTMLElement | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  const debouncedSetHeight = useMemo(
    () =>
      debounce((height: number) => {
        setContainerHeight(height);
      }, 100),
    [],
  );

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        debouncedSetHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      debouncedSetHeight.cancel();
      resizeObserver.disconnect();
    };
  }, [debouncedSetHeight]);

  const maxLevelsPerSide = useMemo(
    () => calculateMaxLevelsPerSide(containerHeight),
    [containerHeight],
  );

  return (
    <YStack ref={containerRef} flex={1}>
      <PerpOrderBook maxLevelsPerSide={maxLevelsPerSide} />
    </YStack>
  );
}

export { PerpOrderBookResizable };
