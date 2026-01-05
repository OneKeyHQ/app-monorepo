import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Icon, ScrollView, Stack, XStack } from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { usePerpsFavorites } from '../../hooks/usePerpsFavorites';

import { FavoriteTokenItem } from './FavoriteTokenItem';

const SCROLL_DISTANCE = 250;

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
        cursor="pointer"
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
    <Stack position="relative" h={40}>
      <ScrollView
        ref={scrollRef as any}
        horizontal
        showsHorizontalScrollIndicator={false}
        bg="$bgApp"
        borderBottomWidth="$px"
        borderBottomColor="$borderSubdued"
        h={24}
        contentContainerStyle={{
          alignItems: 'center',
          px: '$3',
          gap: '$1',
        }}
        onScroll={updateScrollState}
        scrollEventThrottle={16}
      >
        {favoriteItems.map((item) => (
          <FavoriteTokenItem
            key={`${item.assetId}`}
            displayName={item.displayName}
            coinName={item.coinName}
            dexIndex={item.dexIndex}
            assetId={item.assetId}
            onPress={() =>
              void actions.current.changeActiveAsset({ coin: item.coinName })
            }
          />
        ))}
      </ScrollView>
      {canScrollLeft ? (
        <ScrollButton direction="left" onPress={scrollLeft} />
      ) : null}
      {canScrollRight ? (
        <ScrollButton direction="right" onPress={scrollRight} />
      ) : null}
    </Stack>
  );
}

const FavoritesBarMemo = memo(FavoritesBar);
export { FavoritesBarMemo as FavoritesBar };
