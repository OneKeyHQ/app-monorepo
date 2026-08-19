import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { XStack } from '@onekeyhq/components';

import { FooterTickerItem } from './FooterTickerItem';
import {
  getFooterTickerDisplayText,
  getFooterTickerItemKey,
  getFooterTickerSnapshotKey,
  getFooterTickerStructureKey,
  mergeFooterTickerLiveValues,
  shouldAnimateFooterTicker,
} from './footerTickerUtils';

import type {
  IFooterTickerItemData,
  IFooterTickerTextMeasure,
  IFooterTickerTextWidthBudgetMap,
} from './footerTickerUtils';

const SCROLL_SPEED_PX_PER_SEC = 20;

interface IFooterTickerMarqueeProps {
  items: IFooterTickerItemData[];
  deferStructureUpdates?: boolean;
  onItemPress: (item: IFooterTickerItemData) => void;
}

interface IWidthBudgetState {
  snapshotKey: string;
  budgets: IFooterTickerTextWidthBudgetMap;
}

function areWidthBudgetMapsEqual(
  first: IFooterTickerTextWidthBudgetMap,
  second: IFooterTickerTextWidthBudgetMap,
) {
  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);
  return (
    firstKeys.length === secondKeys.length &&
    firstKeys.every((key) => {
      const firstBudget = first[key];
      const secondBudget = second[key];
      return (
        firstBudget.itemWidth === secondBudget?.itemWidth &&
        firstBudget.changeText === secondBudget.changeText &&
        firstBudget.changeWidth === secondBudget.changeWidth &&
        firstBudget.priceText === secondBudget.priceText &&
        firstBudget.priceWidth === secondBudget.priceWidth
      );
    })
  );
}

function FooterTickerMarquee({
  items,
  deferStructureUpdates = false,
  onItemPress,
}: IFooterTickerMarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const firstLoopRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const textMeasureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textMeasureFontRef = useRef('');
  const latestItemsRef = useRef(items);
  const displayStructureKeyRef = useRef(getFooterTickerStructureKey(items));
  const displaySnapshotKeyRef = useRef(getFooterTickerSnapshotKey(items));
  const widthBudgetsRef = useRef<IFooterTickerTextWidthBudgetMap>({});
  const offsetRef = useRef(0);
  const loopWidthRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const needsScrollRef = useRef(false);
  const [displayItems, setDisplayItems] = useState(items);
  const [liveDisplayItems, setLiveDisplayItems] = useState(items);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [widthBudgetState, setWidthBudgetState] = useState<IWidthBudgetState>({
    snapshotKey: '',
    budgets: {},
  });

  latestItemsRef.current = items;

  const displaySnapshotKey = useMemo(
    () => getFooterTickerSnapshotKey(displayItems),
    [displayItems],
  );
  const latestStructureKey = useMemo(
    () => getFooterTickerStructureKey(items),
    [items],
  );
  const latestSnapshotKey = useMemo(
    () => getFooterTickerSnapshotKey(items),
    [items],
  );
  const hasCurrentWidthBudgets =
    widthBudgetState.snapshotKey === displaySnapshotKey &&
    displayItems.every(
      (item) => widthBudgetState.budgets[getFooterTickerItemKey(item)],
    );

  const measureText = useCallback<IFooterTickerTextMeasure>((text) => {
    if (!textMeasureCanvasRef.current) {
      textMeasureCanvasRef.current = document.createElement('canvas');
    }
    const context = textMeasureCanvasRef.current.getContext('2d');
    if (!context || !textMeasureFontRef.current) {
      return Number.POSITIVE_INFINITY;
    }
    context.font = textMeasureFontRef.current;
    return context.measureText(text).width;
  }, []);

  const commitDisplayItems = useCallback(
    (nextItems: IFooterTickerItemData[], allowValueOnlyUpdates = false) => {
      const nextStructureKey = getFooterTickerStructureKey(nextItems);
      const structureChanged =
        displayStructureKeyRef.current !== nextStructureKey;
      if (!structureChanged && !allowValueOnlyUpdates) {
        return false;
      }

      const nextSnapshotKey = getFooterTickerSnapshotKey(nextItems);
      if (displaySnapshotKeyRef.current === nextSnapshotKey) {
        return false;
      }

      displayStructureKeyRef.current = nextStructureKey;
      displaySnapshotKeyRef.current = nextSnapshotKey;
      offsetRef.current = 0;
      loopWidthRef.current = 0;
      lastFrameTimeRef.current = null;
      widthBudgetsRef.current = {};
      setLiveDisplayItems(nextItems);
      setDisplayItems(nextItems);
      return true;
    },
    [],
  );

  const syncWidthBudgets = useCallback(() => {
    const measureContainer = measureRef.current;
    if (!measureContainer) return;

    const measuredItems = Array.from(
      measureContainer.children,
    ) as HTMLElement[];
    const nextBudgets: IFooterTickerTextWidthBudgetMap = {};

    displayItems.forEach((item, index) => {
      const measuredItem = measuredItems[index];
      const changeElement = measuredItem?.children[1] as
        | HTMLElement
        | undefined;
      const priceElement = measuredItem?.children[2] as HTMLElement | undefined;
      if (!measuredItem || !changeElement || !priceElement) return;

      const itemWidth =
        measuredItem.getBoundingClientRect().width || measuredItem.scrollWidth;
      const changeWidth = changeElement.getBoundingClientRect().width;
      const priceWidth = priceElement.getBoundingClientRect().width;
      if (!itemWidth || !changeWidth || !priceWidth) return;

      const { changeText, priceText } = getFooterTickerDisplayText(item);
      nextBudgets[getFooterTickerItemKey(item)] = {
        itemWidth: Math.ceil(itemWidth),
        changeText,
        changeWidth: Math.ceil(changeWidth),
        priceText,
        priceWidth: Math.ceil(priceWidth),
      };

      if (!textMeasureFontRef.current) {
        const style = globalThis.getComputedStyle(priceElement);
        textMeasureFontRef.current =
          style.font ||
          `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      }
    });

    if (Object.keys(nextBudgets).length !== displayItems.length) return;

    widthBudgetsRef.current = nextBudgets;
    setWidthBudgetState((previous) =>
      previous.snapshotKey === displaySnapshotKey &&
      areWidthBudgetMapsEqual(previous.budgets, nextBudgets)
        ? previous
        : { snapshotKey: displaySnapshotKey, budgets: nextBudgets },
    );
  }, [displayItems, displaySnapshotKey]);

  const syncLoopMetrics = useCallback(() => {
    const container = containerRef.current;
    const track = trackRef.current;
    const firstLoop = firstLoopRef.current;
    if (!container || !firstLoop) return 0;

    const singleLoopWidth =
      firstLoop.getBoundingClientRect().width || firstLoop.scrollWidth;
    loopWidthRef.current = singleLoopWidth;
    const nextNeedsScroll = shouldAnimateFooterTicker({
      contentWidth: singleLoopWidth,
      containerWidth: container.clientWidth,
      prefersReducedMotion: prefersReducedMotionRef.current,
    });
    needsScrollRef.current = nextNeedsScroll;
    setNeedsScroll((previous) =>
      previous === nextNeedsScroll ? previous : nextNeedsScroll,
    );

    if (!nextNeedsScroll) {
      offsetRef.current = 0;
      lastFrameTimeRef.current = null;
      if (track) {
        track.style.transform = 'translate3d(0, 0, 0)';
      }
    } else if (offsetRef.current >= singleLoopWidth) {
      offsetRef.current %= singleLoopWidth;
    }

    return singleLoopWidth;
  }, []);

  useLayoutEffect(() => {
    syncWidthBudgets();
  }, [syncWidthBudgets]);

  useLayoutEffect(() => {
    if (!hasCurrentWidthBudgets) return;
    syncLoopMetrics();
  }, [hasCurrentWidthBudgets, syncLoopMetrics, widthBudgetState]);

  useEffect(() => {
    if (!hasCurrentWidthBudgets) return;
    setLiveDisplayItems((previous) => {
      const next = mergeFooterTickerLiveValues({
        displayItems,
        latestItems: items,
        previousLiveItems: previous,
        widthBudgets: widthBudgetsRef.current,
        measureText,
      });
      return getFooterTickerSnapshotKey(previous) ===
        getFooterTickerSnapshotKey(next)
        ? previous
        : next;
    });
  }, [displayItems, hasCurrentWidthBudgets, items, measureText]);

  useEffect(() => {
    if (prefersReducedMotionRef.current || !needsScrollRef.current) {
      commitDisplayItems(latestItemsRef.current, true);
    } else if (!deferStructureUpdates) {
      commitDisplayItems(latestItemsRef.current);
    }
  }, [
    commitDisplayItems,
    deferStructureUpdates,
    latestSnapshotKey,
    latestStructureKey,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    const firstLoop = firstLoopRef.current;
    const measureContainer = measureRef.current;
    if (!container || !firstLoop || !measureContainer) return;

    const observer = new ResizeObserver(() => {
      syncWidthBudgets();
      syncLoopMetrics();
    });
    observer.observe(container);
    observer.observe(firstLoop);
    observer.observe(measureContainer);
    return () => observer.disconnect();
  }, [syncLoopMetrics, syncWidthBudgets]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const mediaQuery = globalThis.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    );
    const syncReducedMotion = () => {
      prefersReducedMotionRef.current = Boolean(mediaQuery?.matches);
      syncLoopMetrics();
    };
    syncReducedMotion();
    mediaQuery?.addEventListener?.('change', syncReducedMotion);

    let frameId = 0;
    const step = (timestamp: number) => {
      const loopWidth = loopWidthRef.current || syncLoopMetrics();
      const lastTimestamp = lastFrameTimeRef.current ?? timestamp;
      const elapsedSeconds = Math.min(timestamp - lastTimestamp, 1000) / 1000;
      lastFrameTimeRef.current = timestamp;

      if (prefersReducedMotionRef.current || !needsScrollRef.current) {
        track.style.transform = 'translate3d(0, 0, 0)';
      } else if (!pausedRef.current && loopWidth > 0) {
        const nextOffset =
          offsetRef.current + elapsedSeconds * SCROLL_SPEED_PX_PER_SEC;
        if (nextOffset >= loopWidth) {
          commitDisplayItems(latestItemsRef.current, true);
          offsetRef.current = 0;
        } else {
          offsetRef.current = nextOffset;
        }
        track.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      }

      frameId = requestAnimationFrame(step);
    };
    frameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameId);
      mediaQuery?.removeEventListener?.('change', syncReducedMotion);
      lastFrameTimeRef.current = null;
    };
  }, [commitDisplayItems, syncLoopMetrics]);

  const handleMouseEnter = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const handleMouseLeave = useCallback(() => {
    pausedRef.current = false;
    lastFrameTimeRef.current = null;
  }, []);

  const renderItems = useCallback(
    (isDuplicate: boolean) =>
      liveDisplayItems.map((item) => (
        <FooterTickerItem
          key={`${getFooterTickerItemKey(item)}${
            isDuplicate ? '-duplicate' : ''
          }`}
          {...item}
          widthBudget={widthBudgetState.budgets[getFooterTickerItemKey(item)]}
          isDuplicate={isDuplicate}
          onPress={onItemPress}
        />
      )),
    [liveDisplayItems, onItemPress, widthBudgetState.budgets],
  );

  const renderLoop = useCallback(
    (isDuplicate: boolean) => (
      <XStack
        ref={isDuplicate ? undefined : (firstLoopRef as any)}
        testID={
          isDuplicate
            ? 'perp-footer-ticker-loop-duplicate'
            : 'perp-footer-ticker-loop'
        }
        aria-hidden={isDuplicate || undefined}
        alignItems="center"
        gap="$6"
        pr="$6"
        flexShrink={0}
        style={{ width: 'max-content' }}
      >
        {renderItems(isDuplicate)}
      </XStack>
    ),
    [renderItems],
  );

  return (
    <XStack
      ref={containerRef as any}
      position="relative"
      flex={1}
      overflow="hidden"
      alignItems="center"
      h="100%"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <XStack
        ref={trackRef as any}
        testID="perp-footer-ticker-track"
        alignItems="center"
        flexShrink={0}
        style={{
          width: 'max-content',
          visibility: hasCurrentWidthBudgets ? 'visible' : 'hidden',
          willChange: needsScroll ? 'transform' : undefined,
        }}
      >
        {renderLoop(false)}
        {needsScroll ? renderLoop(true) : null}
      </XStack>
      <XStack
        ref={measureRef as any}
        aria-hidden
        position="absolute"
        left={0}
        top={0}
        alignItems="center"
        gap="$6"
        pointerEvents="none"
        style={{ visibility: 'hidden', width: 'max-content' }}
      >
        {displayItems.map((item) => (
          <FooterTickerItem
            key={`${getFooterTickerItemKey(item)}-measure`}
            {...item}
            isMeasure
            onPress={onItemPress}
          />
        ))}
      </XStack>
    </XStack>
  );
}

const FooterTickerMarqueeMemo = memo(FooterTickerMarquee);
export { FooterTickerMarqueeMemo as FooterTickerMarquee };
