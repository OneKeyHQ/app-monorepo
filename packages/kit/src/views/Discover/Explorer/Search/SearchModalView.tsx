import { FC, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import {
  Box,
  Divider,
  Modal,
  Pressable,
  Text,
  Typography,
} from '@onekeyhq/components';
import { useDebounce } from '@onekeyhq/kit/src/hooks';
import {
  DiscoverModalRoutes,
  DiscoverRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Discover';

import { homeTab } from '../../../../store/reducers/webTabs';
import DAppIcon from '../../DAppIcon';
import { useDiscoverHistory } from '../../hooks';
import { useSearchLocalDapp } from '../../hooks/useSearchLocalDapp';
import { MatchDAppItemType } from '../explorerUtils';

import { Header, ListEmptyComponent } from './Header';

import type { ListRenderItem } from 'react-native';

type RouteProps = RouteProp<
  DiscoverRoutesParams,
  DiscoverModalRoutes.SearchHistoryModal
>;

export const SearchModalView: FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { url, onSelectorItem } = route.params;

  const [searchContent, setSearchContent] = useState<string>(
    !url || url === homeTab.url ? '' : url,
  );
  const searchContentTerm = useDebounce(searchContent, 300);

  const { loading, searchedDapps } = useSearchLocalDapp(
    searchContentTerm,
    searchContent,
  );

  const allHistories = useDiscoverHistory();

  const flatListData = useMemo(
    () => (searchContentTerm ? searchedDapps : allHistories),
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

  return (
    <Modal
      footer={null}
      flatListProps={{
        data: flatListData,
        // @ts-expect-error
        renderItem,
        ItemSeparatorComponent: () => <Divider />,
        // @ts-expect-error
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        keyExtractor: (item, index) => `${index}-${item?.id}`,
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
