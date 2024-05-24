import { useCallback } from 'react';

import {
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useUniversalSearchActions,
  useUniversalSearchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { ETabMarketRoutes } from '@onekeyhq/shared/src/routes';
import {
  EUniversalSearchType,
  type IIUniversalRecentSearchItem,
} from '@onekeyhq/shared/types/search';

function SearchTextItem({
  item,
  onPress,
}: {
  item: IIUniversalRecentSearchItem;
  onPress: (item: IIUniversalRecentSearchItem) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);
  return (
    <Stack
      ai="center"
      jc="center"
      borderRadius="$2"
      space="$3"
      bg="$bgStrong"
      mt="$3"
      cursor="pointer"
      onPress={handlePress}
    >
      <SizableText px="$2.5" py="$1" size="$bodyMdMedium">
        {item.text}
      </SizableText>
    </Stack>
  );
}

export function RecentSearched({
  searchType,
}: {
  searchType?: EUniversalSearchType;
}) {
  const [{ recentSearch }] = useUniversalSearchAtom();
  const actions = useUniversalSearchActions();

  const navigation = useAppNavigation();
  const handlePress = useCallback(
    async (item: IIUniversalRecentSearchItem) => {
      switch (item.type) {
        case EUniversalSearchType.MarketToken:
          navigation.pop();
          setTimeout(() => {
            navigation.push(ETabMarketRoutes.MarketDetail, {
              coinGeckoId: item.id,
              symbol: item.text,
            });
          }, 80);
          break;
        default:
      }
    },
    [navigation],
  );

  const handleDeleteAll = useCallback(() => {
    actions.current.clearAllRecentSearch();
  }, [actions]);

  return recentSearch.length &&
    searchType === EUniversalSearchType.MarketToken ? (
    <YStack px="$5" pb="$5">
      <XStack jc="space-between">
        <SizableText size="$headingSm" color="$textSubdued">
          Recent searched
        </SizableText>
        <IconButton
          variant="tertiary"
          icon="DeleteOutline"
          color="$textSubdued"
          iconSize="$5"
          onPress={handleDeleteAll}
        />
      </XStack>
      <XStack flexWrap="wrap" space="$3">
        {recentSearch.map((i) => (
          <SearchTextItem onPress={handlePress} item={i} key={i.text} />
        ))}
      </XStack>
    </YStack>
  ) : null;
}
