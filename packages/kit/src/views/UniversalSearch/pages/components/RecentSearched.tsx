import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETabMarketRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import {
  EUniversalSearchType,
  type IIUniversalRecentSearchItem,
} from '@onekeyhq/shared/types/search';

import { urlAccountNavigation } from '../../../Home/pages/urlAccount/urlAccountUtils';

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
    <Stack
      ai="center"
      jc="center"
      borderRadius="$2"
      bg="$bgStrong"
      mt="$2"
      mr="$2"
      cursor="pointer"
      onPress={handlePress}
    >
      <SizableText px="$2.5" py="$1" size="$bodyMdMedium">
        {text}
      </SizableText>
    </Stack>
  );
}

export function RecentSearched({
  filterTypes,
}: {
  filterTypes?: EUniversalSearchType[];
}) {
  const intl = useIntl();
  const [{ recentSearch }] = useUniversalSearchAtom();

  const actions = useUniversalSearchActions();

  const navigation = useAppNavigation();
  const handlePress = useCallback(
    async (item: IIUniversalRecentSearchItem) => {
      switch (item.type) {
        case EUniversalSearchType.Address:
          navigation.pop();
          setTimeout(async () => {
            const { displayAddress, networkId, contextNetworkId } =
              item.extra || {};
            navigation.switchTab(ETabRoutes.Home);
            await urlAccountNavigation.pushUrlAccountPage(navigation, {
              address: displayAddress,
              networkId,
              contextNetworkId,
            });
          }, 80);
          break;
        case EUniversalSearchType.MarketToken:
          navigation.pop();
          setTimeout(() => {
            navigation.switchTab(ETabRoutes.Market);
            navigation.push(ETabMarketRoutes.MarketDetail, {
              token: item.id,
            });
            defaultLogger.market.token.searchToken({
              tokenSymbol: item.id,
              from: 'recentSearch',
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
      <XStack flexWrap="wrap">
        {recentSearch.map((i) => (
          <SearchTextItem
            onPress={handlePress}
            item={i}
            searchType={i.type}
            key={i.text}
          />
        ))}
      </XStack>
    </YStack>
  ) : (
    <XStack pt="$5" />
  );
}
