import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { noop } from 'lodash';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';

import { Icon, SizableText, Stack, XStack } from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  type IPerpFavoritesDisplayMode,
  type IPerpsFavoritesOrderEntry,
  usePerpTokenFavoritesPersistAtom,
  usePerpsFavoritesOrderPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { usePerpsFavorites } from '../../hooks/usePerpsFavorites';

import { FavoriteTokenItem } from './FavoriteTokenItem';

import type {
  DraggableProvided,
  DraggableRubric,
  DraggableStateSnapshot,
  DropResult,
} from 'react-beautiful-dnd';

const SCROLL_DISTANCE = 250;

const getBody = () => document.body;

const DisplayModeToggle = memo(
  ({
    displayMode,
    onToggle,
  }: {
    displayMode: IPerpFavoritesDisplayMode;
    onToggle: () => void;
  }) => (
    <XStack
      onPress={onToggle}
      height={24}
      bg="$bgStrong"
      borderRadius="$2"
      borderCurve="continuous"
      p="$0.5"
      alignItems="center"
      userSelect="none"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
      cursor="default"
    >
      <XStack
        height={20}
        px="$1"
        alignItems="center"
        justifyContent="center"
        borderRadius="$1"
        borderCurve="continuous"
        bg={displayMode === 'price' ? '$bg' : 'transparent'}
        minWidth={24}
      >
        <SizableText
          size="$bodySm"
          color={displayMode === 'price' ? '$text' : '$textSubdued'}
          fontWeight={displayMode === 'price' ? '600' : '400'}
        >
          $
        </SizableText>
      </XStack>
      <XStack
        height={20}
        px="$1"
        alignItems="center"
        justifyContent="center"
        borderRadius="$1"
        borderCurve="continuous"
        bg={displayMode === 'percent' ? '$bg' : 'transparent'}
        minWidth={24}
      >
        <SizableText
          size="$bodySm"
          color={displayMode === 'percent' ? '$text' : '$textSubdued'}
          fontWeight={displayMode === 'percent' ? '600' : '400'}
        >
          %
        </SizableText>
      </XStack>
    </XStack>
  ),
);
DisplayModeToggle.displayName = 'DisplayModeToggle';

const ScrollButton = memo(
  ({
    direction,
    onPress,
  }: {
    direction: 'left' | 'right';
    onPress: () => void;
  }) => {
    const isLeft = direction === 'left';
    return (
      <XStack
        position="absolute"
        top={0}
        bottom={0}
        my="auto"
        {...(isLeft ? { left: 0 } : { right: 0 })}
        width={40}
        height={24}
        alignItems="center"
        justifyContent={isLeft ? 'flex-start' : 'flex-end'}
        onPress={onPress}
        cursor="default"
        style={{
          background: isLeft
            ? 'linear-gradient(90deg, var(--bgApp) 40%, transparent 100%)'
            : 'linear-gradient(270deg, var(--bgApp) 40%, transparent 100%)',
        }}
      >
        <Stack
          width={24}
          height={24}
          justifyContent="center"
          alignItems="center"
          ml={isLeft ? '$1' : 0}
          mr={isLeft ? 0 : '$1'}
        >
          <Icon
            name={
              isLeft ? 'ChevronLeftSmallOutline' : 'ChevronRightSmallOutline'
            }
            size="$5"
            color="$iconSubdued"
          />
        </Stack>
      </XStack>
    );
  },
);
ScrollButton.displayName = 'ScrollButton';

function FavoritesBar() {
  // Bar always shows both modes regardless of which the user is currently
  // trading, so the perp/spot pulls happen unconditionally.
  const { favoriteItems: perpItems, isReady: perpReady } = usePerpsFavorites({
    mode: 'perp',
  });
  const { favoriteItems: spotItems, isReady: spotReady } = usePerpsFavorites({
    mode: 'spot',
  });
  const [favoritesOrder, setFavoritesOrder] =
    usePerpsFavoritesOrderPersistAtom();

  // Membership entries missing from the persisted order are appended at the
  // end, covering legacy data and toggles done outside the FavoriteButton.
  const favoriteItems = useMemo(() => {
    const merged = [...perpItems, ...spotItems];
    const lookup = new Map<string, (typeof merged)[number]>();
    for (const item of merged) {
      lookup.set(`${item.mode}:${item.coinName}`, item);
    }
    const ordered: typeof merged = [];
    const seen = new Set<string>();
    for (const entry of favoritesOrder.sequence) {
      const key = `${entry.mode}:${entry.coinName}`;
      const item = lookup.get(key);
      if (item) {
        ordered.push(item);
        seen.add(key);
      }
    }
    for (const item of merged) {
      const key = `${item.mode}:${item.coinName}`;
      if (!seen.has(key)) ordered.push(item);
    }
    return ordered;
  }, [perpItems, spotItems, favoritesOrder]);

  // Idempotent reconciliation — only writes when sequence drifts from
  // membership, so callers that toggle favorites without touching this atom
  // (initial migration, external watchlist sync) self-heal on next render.
  // Gated on isReady so the persisted drag-reorder is not wiped by an empty
  // run before the async universe data resolves.
  useEffect(() => {
    if (!perpReady || !spotReady) return;
    setFavoritesOrder((prev) => {
      const allKeys = new Set<string>();
      for (const it of perpItems) allKeys.add(`${it.mode}:${it.coinName}`);
      for (const it of spotItems) allKeys.add(`${it.mode}:${it.coinName}`);
      const filtered = prev.sequence.filter((e) =>
        allKeys.has(`${e.mode}:${e.coinName}`),
      );
      const seqKeys = new Set(filtered.map((e) => `${e.mode}:${e.coinName}`));
      const additions: IPerpsFavoritesOrderEntry[] = [];
      for (const it of [...perpItems, ...spotItems]) {
        const key = `${it.mode}:${it.coinName}`;
        if (!seqKeys.has(key)) {
          additions.push({ mode: it.mode, coinName: it.coinName });
          seqKeys.add(key);
        }
      }
      const next = [...filtered, ...additions];
      const changed =
        next.length !== prev.sequence.length ||
        next.some(
          (e, i) =>
            e.mode !== prev.sequence[i]?.mode ||
            e.coinName !== prev.sequence[i]?.coinName,
        );
      return changed ? { sequence: next } : prev;
    });
  }, [perpItems, spotItems, perpReady, spotReady, setFavoritesOrder]);

  const actions = useHyperliquidActions();
  const hasFavorites = favoriteItems.length > 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [perpFavorites, setPerpFavorites] = usePerpTokenFavoritesPersistAtom();
  // displayMode is shared across both modes; only the perp atom carries it.
  const displayMode = perpFavorites.displayMode ?? 'price';
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  // Reorder writes only the unified order atom; mode-specific membership
  // atoms are untouched, so cross-mode drag is safe.
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setIsDragging(false);
      if (!result.destination) return;
      if (result.source.index === result.destination.index) return;

      const sourceItem = favoriteItems[result.source.index];
      const destItem = favoriteItems[result.destination.index];
      if (!sourceItem || !destItem) return;

      setFavoritesOrder((prev) => {
        const next = [...prev.sequence];
        const sourceIdx = next.findIndex(
          (e) =>
            e.mode === sourceItem.mode && e.coinName === sourceItem.coinName,
        );
        const destIdx = next.findIndex(
          (e) => e.mode === destItem.mode && e.coinName === destItem.coinName,
        );
        if (sourceIdx === -1 || destIdx === -1) return prev;
        const [moved] = next.splice(sourceIdx, 1);
        next.splice(destIdx, 0, moved);
        return { sequence: next };
      });
    },
    [favoriteItems, setFavoritesOrder],
  );

  const renderClone = useCallback(
    (
      provided: DraggableProvided,
      _snapshot: DraggableStateSnapshot,
      rubric: DraggableRubric,
    ) => {
      const item = favoriteItems[rubric.source.index];
      if (!item) {
        return <div ref={provided.innerRef} {...provided.draggableProps} />;
      }
      return (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <FavoriteTokenItem
            displayName={item.displayName}
            coinName={item.coinName}
            dexIndex={item.dexIndex}
            assetId={item.assetId}
            imageTokenName={item.imageTokenName}
            mode={item.mode}
            displayMode={displayMode}
            onPress={noop}
          />
        </div>
      );
    },
    [favoriteItems, displayMode],
  );

  const toggleDisplayMode = useCallback(() => {
    setPerpFavorites((prev) => ({
      ...prev,
      displayMode: prev.displayMode === 'price' ? 'percent' : 'price',
    }));
  }, [setPerpFavorites]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(
      hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    );
  }, []);

  useLayoutEffect(() => {
    requestAnimationFrame(updateScrollState);
  }, [favoriteItems, updateScrollState]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    return () => {
      el.removeEventListener('scroll', updateScrollState);
    };
  }, [updateScrollState, hasFavorites]);

  const mergeRefs = useCallback(
    (droppableInnerRef: (element: HTMLElement | null) => void) =>
      (node: HTMLDivElement | null) => {
        droppableInnerRef(node);
        (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
      },
    [],
  );

  const scrollLeft = useCallback(() => {
    scrollRef.current?.scrollBy({ left: -SCROLL_DISTANCE, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    scrollRef.current?.scrollBy({ left: SCROLL_DISTANCE, behavior: 'smooth' });
  }, []);

  // Perp price subscription is gated on bar membership rather than on the
  // active trading mode, since perp favorites stay visible while browsing spot.
  const hasPerpFavorites = perpItems.length > 0;
  useEffect(() => {
    if (hasPerpFavorites) {
      const currentActions = actions.current;
      currentActions.markAllAssetCtxsRequired();
      return () => {
        currentActions.markAllAssetCtxsNotRequired();
      };
    }
  }, [actions, hasPerpFavorites]);

  // Spot ctxs come from a planner-driven WS sub, not a refcount, so we surface
  // bar visibility as a viewState flag the planner can OR into spotAssetCtxsEnabled.
  // Otherwise spot favorites rendered while in perp mode would lack prevDayPx
  // and show 0% / stale 24h change in the bar.
  const hasSpotFavorites = spotItems.length > 0;
  useEffect(() => {
    if (hasSpotFavorites) {
      const currentActions = actions.current;
      currentActions.setTradeRouteViewState({ favoritesBarSpotActive: true });
      return () => {
        currentActions.setTradeRouteViewState({
          favoritesBarSpotActive: false,
        });
      };
    }
  }, [actions, hasSpotFavorites]);

  if (!hasFavorites) {
    return null;
  }

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <XStack
        position="relative"
        h={40}
        alignItems="center"
        gap="$3"
        flex={1}
        pl="$5"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
      >
        <DisplayModeToggle
          displayMode={displayMode}
          onToggle={toggleDisplayMode}
        />
        <Stack position="relative" flex={1} h={40} justifyContent="center">
          <Droppable
            droppableId="favorites-bar"
            direction="horizontal"
            renderClone={renderClone}
            getContainerForClone={getBody}
          >
            {(droppableProvided) => (
              <div
                ref={mergeRefs(droppableProvided.innerRef)}
                {...droppableProvided.droppableProps}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                }}
              >
                {favoriteItems.map((item, index) => {
                  // Mode-tagged so a future symbol overlap between perp and
                  // spot can't collapse two rows onto one draggable id.
                  const draggableKey = `${item.mode}:${item.coinName}`;
                  return (
                    <Draggable
                      key={draggableKey}
                      draggableId={draggableKey}
                      index={index}
                    >
                      {(draggableProvided) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                          {...draggableProvided.dragHandleProps}
                          style={{
                            ...draggableProvided.draggableProps.style,
                            flexShrink: 0,
                            marginRight:
                              index < favoriteItems.length - 1 ? 4 : 0,
                          }}
                        >
                          <FavoriteTokenItem
                            displayName={item.displayName}
                            coinName={item.coinName}
                            dexIndex={item.dexIndex}
                            assetId={item.assetId}
                            imageTokenName={item.imageTokenName}
                            mode={item.mode}
                            displayMode={displayMode}
                            onPress={() =>
                              void actions.current.switchTradeInstrument({
                                coin: item.coinName,
                                mode: item.mode,
                              })
                            }
                          />
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {droppableProvided.placeholder}
              </div>
            )}
          </Droppable>
          {!isDragging && canScrollLeft ? (
            <ScrollButton direction="left" onPress={scrollLeft} />
          ) : null}
          {!isDragging && canScrollRight ? (
            <ScrollButton direction="right" onPress={scrollRight} />
          ) : null}
        </Stack>
      </XStack>
    </DragDropContext>
  );
}

const FavoritesBarMemo = memo(FavoritesBar);
export { FavoritesBarMemo as FavoritesBar };
