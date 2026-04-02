import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
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
  const { favoriteItems } = usePerpsFavorites();
  const actions = useHyperliquidActions();
  const hasFavorites = favoriteItems.length > 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [favoritesSettings, setFavoritesSettings] =
    usePerpTokenFavoritesPersistAtom();
  const displayMode = favoritesSettings.displayMode ?? 'price';
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setIsDragging(false);
      if (!result.destination) return;
      if (result.source.index === result.destination.index) return;

      // Use coinName to locate items in persisted array (rendered list may be a filtered subset).
      setFavoritesSettings((prev) => {
        const sourceCoin = favoriteItems[result.source.index]?.coinName;
        const destCoin = favoriteItems[result.destination!.index]?.coinName;
        if (!sourceCoin || !destCoin) return prev;
        const newFavorites = [...prev.favorites];
        const sourceIdx = newFavorites.indexOf(sourceCoin);
        const destIdx = newFavorites.indexOf(destCoin);
        if (sourceIdx === -1 || destIdx === -1) return prev;
        const [moved] = newFavorites.splice(sourceIdx, 1);
        newFavorites.splice(destIdx, 0, moved);
        return { ...prev, favorites: newFavorites };
      });
    },
    [setFavoritesSettings, favoriteItems],
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
            displayMode={displayMode}
            onPress={noop}
          />
        </div>
      );
    },
    [favoriteItems, displayMode],
  );

  const toggleDisplayMode = useCallback(() => {
    setFavoritesSettings((prev) => ({
      ...prev,
      displayMode: prev.displayMode === 'price' ? 'percent' : 'price',
    }));
  }, [setFavoritesSettings]);

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

  useEffect(() => {
    if (hasFavorites) {
      const currentActions = actions.current;
      currentActions.markAllAssetCtxsRequired();
      return () => {
        currentActions.markAllAssetCtxsNotRequired();
      };
    }
  }, [actions, hasFavorites]);

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
                          displayMode={displayMode}
                          onPress={() =>
                            void actions.current.changeActiveAsset({
                              coin: item.coinName,
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
