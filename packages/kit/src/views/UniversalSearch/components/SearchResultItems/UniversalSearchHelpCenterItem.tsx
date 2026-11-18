import { useCallback } from 'react';

import { Icon } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useUniversalSearchActions } from '@onekeyhq/kit/src/states/jotai/contexts/universalSearch';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { openUrlInDiscoveryOrExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  EUniversalSearchSource,
  IUniversalSearchHelpCenter,
} from '@onekeyhq/shared/types/search';

interface IUniversalSearchHelpCenterItemProps {
  item: IUniversalSearchHelpCenter;
  getSearchInput: () => string;
  source: EUniversalSearchSource;
}

export function UniversalSearchHelpCenterItem({
  item,
  getSearchInput,
  source,
}: IUniversalSearchHelpCenterItemProps) {
  const navigation = useAppNavigation();
  const universalSearchActions = useUniversalSearchActions();
  const { id, title, summary, url } = item.payload;

  const handlePress = useCallback(async () => {
    const searchInput = getSearchInput();
    defaultLogger.universalSearch.search.universalSearchClick({
      source,
      searchText: searchInput,
      type: item.type,
      itemId: id,
      itemTitle: title,
    });

    navigation.pop();
    await timerUtils.wait(300);

    openUrlInDiscoveryOrExternal({ url, title });

    await timerUtils.wait(10);
    universalSearchActions.current.addIntoRecentSearchList({
      id: `help-center-${id}`,
      text: title,
      type: item.type,
      timestamp: Date.now(),
      extra: {
        // Refill the query that found the article, not its long title.
        autoFillText: searchInput || title,
      },
    });
  }, [
    getSearchInput,
    id,
    item.type,
    navigation,
    source,
    title,
    universalSearchActions,
    url,
  ]);

  return (
    <ListItem
      testID={`universal-search-help-center-item-${id}`}
      onPress={handlePress}
      cursor="default"
    >
      <Icon name="BookOpenOutline" size="$6" color="$iconSubdued" />
      <ListItem.Text
        flex={1}
        primary={title}
        primaryTextProps={{ numberOfLines: 2, userSelect: 'none' }}
        secondary={summary.replace(/\s+/g, ' ').trim() || undefined}
        secondaryTextProps={{ numberOfLines: 2, userSelect: 'none' }}
      />
    </ListItem>
  );
}
