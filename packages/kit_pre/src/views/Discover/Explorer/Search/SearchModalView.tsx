import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';

import {
  Box,
  Divider,
  Modal,
  Pressable,
  Text,
  Typography,
} from '@onekeyhq/components';
import { useDebounce } from '@onekeyhq/kit/src/hooks';

import { homeTab } from '../../../../store/observable/webTabs';
import DAppIcon from '../../components/DAppIcon';
import { useUserBrowserHistories } from '../../hooks';
import { useSearchDapps } from '../../hooks/useSearchDapps';
import { getWebTabs } from '../Controller/useWebTabs';

import { Header, ListEmptyComponent } from './Header';

import type { DiscoverModalRoutes, DiscoverRoutesParams } from '../../type';
import type { MatchDAppItemType } from '../explorerUtils';
import type { RouteProp } from '@react-navigation/core';
import type { FlatListProps, ListRenderItem } from 'react-native';

type RouteProps = RouteProp<
  DiscoverRoutesParams,
  DiscoverModalRoutes.SearchHistoryModal
>;

const ItemSeparatorComponent = () => <Divider />;

export const SearchModalView: FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { url, onSelectorItem } = route.params;

  const [searchContent, setSearchContent] = useState<string>(() => {
    if (url !== undefined && url !== homeTab.url) {
      return url;
    }
    const { tab } = getWebTabs();
    if (tab?.url && tab.url !== homeTab.url) {
      return tab.url;
    }
    return '';
  });
  const searchContentTerm = useDebounce(searchContent, 300);

  const { loading, searchedDapps } = useSearchDapps(
    searchContentTerm,
    searchContent,
  );

  const allHistories = useUserBrowserHistories();

  const flatListData = useMemo(
    () => (searchContentTerm ? searchedDapps : allHistories.slice(0, 8)),
    [searchContentTerm, allHistories, searchedDapps],
  );

  const onSelectHistory = (item: MatchDAppItemType | string) => {
    navigation.goBack();
    onSelectorItem?.(item);
  };

  const renderItem: ListRenderItem<MatchDAppItemType> = ({ item, index }) => {
    const logoURL = item.dapp?.logoURL ?? item.webSite?.favicon;
    const name = item.dapp?.name ?? item.webSite?.title ?? 'Unknown';
    const dappUrl = item.dapp?.url ?? item.webSite?.url;
    const networkIds = item.dapp?.networkIds;

    return (
      <Pressable.Item
        p={4}
        key={`${index}-${item.id}`}
        borderTopRadius={index === 0 ? '12px' : '0px'}
        // eslint-disable-next-line no-unsafe-optional-chaining
        borderRadius={index === flatListData?.length - 1 ? '12px' : '0px'}
        onPress={() => {
          onSelectHistory(item);
        }}
      >
        <Box w="100%" flexDirection="row" alignItems="center">
          {logoURL && (
            <DAppIcon size={38} url={logoURL} networkIds={networkIds} />
          )}

          <Box mx={3} flexDirection="column" flex={1}>
            <Text
              numberOfLines={1}
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              {name ?? 'Unknown'}
            </Text>
            <Typography.Body2 numberOfLines={1} color="text-subdued">
              {dappUrl}
            </Typography.Body2>
          </Box>
        </Box>
      </Pressable.Item>
    );
  };

  const keyExtractor: FlatListProps<MatchDAppItemType>['keyExtractor'] = (
    item,
    index,
  ) => `${index}-${item?.id}`;

  return (
    <Modal
      footer={null}
      flatListProps={{
        data: flatListData,
        renderItem,
        ItemSeparatorComponent,
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        keyExtractor,
        showsVerticalScrollIndicator: false,
        ListEmptyComponent: (
          <ListEmptyComponent isLoading={loading} terms={searchContentTerm} />
        ),
        ListHeaderComponent: (
          <Header
            keyword={searchContent}
            onChange={setSearchContent}
            onSelectHistory={onSelectHistory}
            onSubmitContent={(content) => {
              onSelectHistory(content);
            }}
          />
        ),
      }}
    />
  );
};
