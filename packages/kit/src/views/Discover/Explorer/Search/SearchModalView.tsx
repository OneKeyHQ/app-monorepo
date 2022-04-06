import React, { FC, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import {
  Box,
  Divider,
  Image,
  Modal,
  Pressable,
  ScrollableFlatListProps,
  Text,
  Typography,
} from '@onekeyhq/components';
import { useDebounce } from '@onekeyhq/kit/src/hooks';
import {
  DiscoverModalRoutes,
  DiscoverRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/Discover';

import { Header, ListEmptyComponent } from './Header';
import { useSearchDapps } from './useSearchDapps';
import { useSearchHistories } from './useSearchHistories';

import type { HistoryItem } from './types';

type RouteProps = RouteProp<
  DiscoverRoutesParams,
  DiscoverModalRoutes.SearchHistoryModal
>;

const SearchModalView: FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { onSelectorItem } = route.params;

  const [searchContent, setSearchContent] = useState<string>('');
  const searchContentTerm = useDebounce(searchContent, 200);

  const { loading: dappLoading, searchedDapps } = useSearchDapps(
    searchContentTerm,
    searchContent,
  );

  const {
    loading: historyLoading,
    searchedHistories,
    allHistories,
  } = useSearchHistories(searchContentTerm, searchContent);

  const flatListData = useMemo(
    () => (searchContentTerm ? searchedDapps : allHistories),
    [searchContentTerm, allHistories, searchedDapps],
  );

  const onSelectHistory = (item: HistoryItem) => {
    navigation.goBack();
    onSelectorItem?.(item);
  };

  const renderItem: ScrollableFlatListProps<HistoryItem>['renderItem'] = ({
    item,
    index,
  }) => (
    <Pressable.Item
      p={4}
      key={index}
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === flatListData?.length - 1 ? '12px' : '0px'}
      onPress={() => {
        onSelectHistory(item);
      }}
    >
      <Box w="100%" flexDirection="row" alignItems="center">
        <Image w="38px" h="38px" borderRadius="10px" src={item.logoURI} />
        <Box mx={3} flexDirection="column" flex={1}>
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {item.title}
          </Text>
          <Typography.Body2 color="text-subdued">{item.url}</Typography.Body2>
        </Box>
      </Box>
    </Pressable.Item>
  );

  return (
    <Modal
      footer={null}
      flatListProps={{
        data: flatListData,
        // @ts-expect-error
        renderItem,
        ItemSeparatorComponent: () => <Divider />,
        keyExtractor: (_item) => (_item as HistoryItem).url,
        showsVerticalScrollIndicator: false,
        ListEmptyComponent: (
          <ListEmptyComponent
            isLoading={historyLoading || dappLoading}
            terms={searchContentTerm}
          />
        ),
        ListHeaderComponent: (
          <Header
            histories={searchedHistories}
            keyword={searchContent}
            terms={searchContentTerm}
            onChange={setSearchContent}
            onSelectHistory={onSelectHistory}
            onSubmitContent={(content) => {
              onSelectHistory({ url: content, logoURI: '', title: '' });
            }}
          />
        ),
      }}
    />
  );
};

export { SearchModalView };
