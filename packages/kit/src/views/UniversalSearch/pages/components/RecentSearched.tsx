import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import {
  useUniversalSearchActions,
  useUniversalSearchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EUniversalSearchType,
  type IIUniversalRecentSearchItem,
} from '@onekeyhq/shared/types/search';

function SearchTextItem({
  item,
  onPress,
  searchType,
}: {
  item: IIUniversalRecentSearchItem;
  onPress: (item: IIUniversalRecentSearchItem) => void;
  searchType?: EUniversalSearchType;
}) {
  const handlePress = useCallback(() => {
    onPress(item);
  }, [item, onPress]);

  const text = useMemo(() => {
    const itemText = item.text;
    switch (searchType) {
      case EUniversalSearchType.MarketToken:
        return itemText.toUpperCase();
      case EUniversalSearchType.Address:
        return accountUtils.shortenAddress({
          address: itemText,
          leadingLength: 6,
          trailingLength: 6,
        });
      default:
        return itemText;
    }
  }, [item.text, searchType]);
  return (
    <Button
      size="small"
      variant="secondary"
      mt="$2"
      mr="$2"
      cursor="pointer"
      onPress={handlePress}
    >
      {text}
    </Button>
  );
}

export function RecentSearched({
  filterTypes,
  onSearchTextFill,
}: {
  filterTypes?: EUniversalSearchType[];
  onSearchTextFill?: (text: string) => void;
}) {
  const intl = useIntl();
  const [{ recentSearch }] = useUniversalSearchAtom();

  const actions = useUniversalSearchActions();

  const handlePress = useCallback(
    (item: IIUniversalRecentSearchItem) => {
      const textToFill =
        item.extra?.autoFillText && typeof item.extra?.autoFillText === 'string'
          ? item.extra?.autoFillText
          : item.text;
      onSearchTextFill?.(textToFill);
    },
    [onSearchTextFill],
  );

  const handleDeleteAll = useCallback(() => {
    actions.current.clearAllRecentSearch();
  }, [actions]);

  return recentSearch.length &&
    filterTypes?.includes(EUniversalSearchType.MarketToken) ? (
    <YStack px="$5" pb="$5">
      <XStack jc="space-between" pt="$5">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_recent_searched })}
        </SizableText>
        <IconButton
          variant="tertiary"
          icon="DeleteOutline"
          color="$textSubdued"
          iconSize="$5"
          onPress={handleDeleteAll}
        />
      </XStack>
      <Stack
        overflow="hidden"
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          maxHeight: 78,
        }}
      >
        {recentSearch.map((i) => (
          <SearchTextItem
            onPress={handlePress}
            item={i}
            searchType={i.type}
            key={i.text}
          />
        ))}
      </Stack>
    </YStack>
  ) : (
    <XStack pt="$5" />
  );
}
