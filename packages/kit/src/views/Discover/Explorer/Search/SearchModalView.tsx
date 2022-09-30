import { FC, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';

import {
  Box,
  Center,
  Divider,
  Icon,
  Image,
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

import DAppIcon from '../../DAppIcon';
import { MatchDAppItemType } from '../explorerUtils';

import { Header, ListEmptyComponent } from './Header';
import { useLimitHistories } from './useLimitHistories';
import { useSearchLocalDapp } from './useSearchLocalDapp';

import type { FlatListProps } from 'react-native';

type RouteProps = RouteProp<
  DiscoverRoutesParams,
  DiscoverModalRoutes.SearchHistoryModal
>;

const SearchModalView: FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { url, onSelectorItem } = route.params;

  const [searchContent, setSearchContent] = useState<string>(url ?? '');
  const searchContentTerm = useDebounce(searchContent, 600);

  const { loading, searchedDapps } = useSearchLocalDapp(
    searchContentTerm,
    searchContent,
  );

  const { limitHistories: allHistories } = useLimitHistories();

  const flatListData = useMemo(
    () => (searchContentTerm ? searchedDapps : allHistories),
    [searchContentTerm, allHistories, searchedDapps],
  );

  const onSelectHistory = (item: MatchDAppItemType | string) => {
    navigation.goBack();
    onSelectorItem?.(item);
  };

  const renderItem: FlatListProps<MatchDAppItemType>['renderItem'] = ({
    item,
    index,
  }) => {
    const { favicon: dappFavicon, chain, name, url: dappUrl } = item.dapp || {};
    const {
      favicon: webSiteFavicon,
      title,
      url: webSiteUrl,
    } = item.webSite || {};

    return (
      <Pressable.Item
        p={4}
        key={`search-history-item-${index}-${item.id}`}
        borderTopRadius={index === 0 ? '12px' : '0px'}
        borderRadius={index === flatListData?.length - 1 ? '12px' : '0px'}
        onPress={() => {
          onSelectHistory(item);
        }}
      >
        <Box w="100%" flexDirection="row" alignItems="center">
          {(!!dappFavicon || item.dapp) && (
            <DAppIcon size={38} favicon={dappFavicon ?? ''} chain={chain} />
          )}
          {(!!webSiteFavicon || item.webSite) && (
            <Box width="38px" height="38px">
              <Image
                width="38px"
                height="38px"
                source={{ uri: webSiteFavicon }}
                borderRadius="10px"
                borderWidth="1px"
                borderColor="border-subdued"
                fallbackElement={
                  <Center
                    w="38px"
                    h="38px"
                    borderRadius="10px"
                    borderWidth="1px"
                    borderColor="border-subdued"
                  >
                    <Icon size={20} name="GlobeSolid" />
                  </Center>
                }
              />
            </Box>
          )}

          <Box mx={3} flexDirection="column" flex={1}>
            <Text
              numberOfLines={1}
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
            >
              {name ?? title ?? 'Unknown'}
            </Text>
            <Typography.Body2 numberOfLines={1} color="text-subdued">
              {dappUrl ?? webSiteUrl}
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
