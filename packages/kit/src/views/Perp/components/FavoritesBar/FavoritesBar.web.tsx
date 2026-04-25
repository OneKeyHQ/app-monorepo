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
  usePerpTokenFavoritesPersistAtom,
  useSpotTokenFavoritesPersistAtom,
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
  // Show both perp and spot favorites side by side regardless of current mode.
  // Spot items render their pair name (PURR/USDC, /USDH, etc.) via displayName
  // computed in usePerpsFavorites, so users can tell quote currency at a glance.
  const { favoriteItems: perpItems } = usePerpsFavorites({ mode: 'perp' });
  const { favoriteItems: spotItems } = usePerpsFavorites({ mode: 'spot' });
  const favoriteItems = useMemo(
    () => [...perpItems, ...spotItems],
    [perpItems, spotItems],
  );
  const actions = useHyperliquidActions();
  const hasFavorites = favoriteItems.length > 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [perpFavorites, setPerpFavorites] = usePerpTokenFavoritesPersistAtom();
  const [, setSpotFavorites] = useSpotTokenFavoritesPersistAtom();
  // displayMode is a UI preference shared by perps and spot favorites bars,
  // so it always lives on the perp atom (spot atom has no displayMode field).
  const displayMode = perpFavorites.displayMode ?? 'price';
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setIsDragging(false);
      if (!result.destination) return;
      if (result.source.index === result.destination.index) return;

      const sourceItem = favoriteItems[result.source.index];
      const destItem = favoriteItems[result.destination.index];
      if (!sourceItem || !destItem) return;
      // Cross-mode drag is a no-op — perp and spot favorites live in separate
      // atoms; reorder only persists when source and destination share a mode.
      if (sourceItem.mode !== destItem.mode) return;

      const reorder = (prevFavorites: string[]): string[] | undefined => {
        const next = [...prevFavorites];
        const sourceIdx = next.indexOf(sourceItem.coinName);
        const destIdx = next.indexOf(destItem.coinName);
        if (sourceIdx === -1 || destIdx === -1) return undefined;
        const [moved] = next.splice(sourceIdx, 1);
        next.splice(destIdx, 0, moved);
        return next;
      };

      if (sourceItem.mode === 'spot') {
        setSpotFavorites((prev) => {
          const next = reorder(prev.favorites);
          return next ? { ...prev, favorites: next } : prev;
        });
      } else {
        setPerpFavorites((prev) => {
          const next = reorder(prev.favorites);
          return next ? { ...prev, favorites: next } : prev;
        });
      }
    },
    [setPerpFavorites, setSpotFavorites, favoriteItems],
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

  // Subscribe to perp asset ctxs whenever any perp favorite is rendered,
  // independent of current trading mode — perp items now appear in the bar
  // even while user is browsing spot.
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
                {favoriteItems.map((item, index) => (
                  <Draggable
                    key={item.coinName}
                    draggableId={item.coinName}
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
                          marginRight: index < favoriteItems.length - 1 ? 4 : 0,
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
                ))}
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
