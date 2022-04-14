import React, { FC, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import {
  Box,
  Divider,
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

import DAppIcon from '../../DAppIcon';

import { Header, ListEmptyComponent } from './Header';
import { useSearchHistories } from './useSearchHistories';

import type { DAppItemType } from '../../type';

type RouteProps = RouteProp<
  DiscoverRoutesParams,
  DiscoverModalRoutes.SearchHistoryModal
>;

const SearchModalView: FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { url, onSelectorItem } = route.params;

  const [searchContent, setSearchContent] = useState<string>(url ?? '');
  const searchContentTerm = useDebounce(searchContent, 200);

  const { loading, searchedHistories, allHistories } = useSearchHistories(
    searchContentTerm,
    searchContent,
  );

  const flatListData = useMemo(
    () => (searchContentTerm ? searchedHistories : allHistories),
    [searchContentTerm, allHistories, searchedHistories],
  );

  const onSelectHistory = (item: DAppItemType | string) => {
    navigation.goBack();
    onSelectorItem?.(item);
  };

  const renderItem: ScrollableFlatListProps<DAppItemType>['renderItem'] = ({
    item,
    index,
  }) => (
    <Pressable.Item
      p={4}
      key={`search-history-item-${index}-${item.url}`}
      borderTopRadius={index === 0 ? '12px' : '0px'}
      borderRadius={index === flatListData?.length - 1 ? '12px' : '0px'}
      onPress={() => {
        onSelectHistory(item);
      }}
    >
      <Box w="100%" flexDirection="row" alignItems="center">
        <DAppIcon size={38} favicon={item.favicon} chain={item.chain} />
        <Box mx={3} flexDirection="column" flex={1}>
          <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
            {item.name}
          </Text>
          <Typography.Body2 numberOfLines={1} color="text-subdued">
            {item.url}
          </Typography.Body2>
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
        keyExtractor: (_item, index) => {
          try {
            const item = _item as DAppItemType;
            return `${index}-${item.url}-${item.name}`;
          } catch (e) {
            return index.toString();
          }
        },
        showsVerticalScrollIndicator: false,
        ListEmptyComponent: (
          <ListEmptyComponent isLoading={loading} terms={searchContentTerm} />
        ),
        ListHeaderComponent: (
          <Header
            terms={searchContentTerm}
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

export { SearchModalView };
