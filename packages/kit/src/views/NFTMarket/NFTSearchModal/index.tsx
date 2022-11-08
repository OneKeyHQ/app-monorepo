import React, { FC, useCallback, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { Row } from 'native-base';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Center,
  Divider,
  Empty,
  FlatList,
  IconButton,
  Modal,
  Searchbar,
  Spinner,
  Text,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useUserDevice,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import { Network } from '@onekeyhq/engine/src/types/network';
import { Collection, NFTMarketRanking } from '@onekeyhq/engine/src/types/nft';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../hooks';
import ChainSelector from '../ChainSelector';
import CollectionLogo from '../CollectionLogo';
import { useDefaultNetWork } from '../Home/hook';
import RankingList from '../Home/Stats/Ranking/Container/Mobile';
import StatsItemCell from '../Home/Stats/StatsItemCell';

import {
  SearchNFTCollectionRoutes,
  SearchNFTCollectionRoutesParams,
} from './type';
import { useCollectionSearch } from './useCollectionSearch';

const Header: FC<{
  keyword: string;
  setKeyword: (keyword: string) => void;
  selectNetwork: Network;
  onSelectNetWork: (network: Network) => void;
}> = ({ keyword, setKeyword, selectNetwork, onSelectNetWork }) => {
  const intl = useIntl();
  const modalClose = useModalClose();
  const isSmallScreen = useIsVerticalLayout();
  const { screenWidth } = useUserDevice();

  const width = isSmallScreen ? screenWidth : 480;
  return (
    <Box width={`${width}px`} height="57px" position="absolute">
      <Box
        borderTopRadius="24px"
        flexDirection="row"
        alignItems="center"
        paddingX="16px"
        bgColor="surface-subdued"
        height="57px"
      >
        <Searchbar
          bgColor="surface-subdued"
          w="full"
          borderWidth={0}
          rightElement={
            <Row alignItems="center">
              <ChainSelector
                tiggerProps={{ paddingRight: '16px' }}
                selectedNetwork={selectNetwork}
                onChange={(n) => {
                  onSelectNetWork(n);
                }}
              />
              {!isSmallScreen && (
                <IconButton
                  size="base"
                  name="CloseSolid"
                  type="plain"
                  circle
                  onPress={modalClose}
                />
              )}
            </Row>
          }
          height="57px"
          placeholder={intl.formatMessage({
            id: 'form__nft_search_placeholder',
          })}
          value={keyword}
          onClear={() => {
            setKeyword('');
          }}
          onChangeText={(text) => {
            setKeyword(text);
          }}
        />
      </Box>
      <Divider />
    </Box>
  );
};

type Props = {
  isLoading?: boolean;
  listData?: Collection[];
  selectNetwork: Network;
};

const DefaultList: FC<Props> = ({ selectNetwork }) => {
  const { serviceNFT } = backgroundApiProxy;
  const { bottom } = useSafeAreaInsets();
  const intl = useIntl();

  const [listData, updateListData] = useState<NFTMarketRanking[]>([]);
  useEffect(() => {
    (async () => {
      const data = await serviceNFT.getMarketRanking({
        chain: selectNetwork?.id,
        time: '1d',
      });
      if (data) {
        updateListData(data);
      }
    })();
  }, [selectNetwork?.id, serviceNFT]);

  return (
    <Box paddingX="16px" flex={1} overflow="hidden">
      <RankingList
        selectNetwork={selectNetwork}
        listData={listData}
        ListHeaderComponent={() => (
          <Box height="117px" width="full" paddingTop="57px" paddingX="16px">
            <Box
              flexDirection="column"
              justifyContent="center"
              width="full"
              height="60px"
            >
              <Text typography="Heading">
                {intl.formatMessage({
                  id: 'content__ranking',
                })}
              </Text>
            </Box>
          </Box>
        )}
        ListFooterComponent={() => <Box height={`${bottom}px`} />}
      />
    </Box>
  );
};

const SearchResultList: FC<Props> = ({
  isLoading,
  listData,
  selectNetwork,
}) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const route =
    useRoute<
      RouteProp<
        SearchNFTCollectionRoutesParams,
        SearchNFTCollectionRoutes.SearchModal
      >
    >();
  const { onSelectCollection } = route.params;
  const renderItem: ListRenderItem<Collection> = useCallback(
    ({ item }) => {
      const items = `${item?.itemsTotal ?? 0} Items`;
      const floorPrice = item?.floorPrice
        ? `${intl.formatMessage({
            id: 'content__floor',
          })} ${item?.floorPrice} ${item.priceSymbol ?? ''}`
        : undefined;
      const subTitle = `${items || ''} • ${floorPrice || ''}`;
      return (
        <StatsItemCell
          onPress={() => {
            onSelectCollection({
              networkId: selectNetwork.id,
              contractAddress: item.contractAddress as string,
            });
          }}
          height="56px"
          logoComponent={
            <CollectionLogo src={item.logoUrl} width="56px" height="56px" />
          }
          title={item.name}
          subTitle={subTitle}
        />
      );
    },
    [intl, onSelectCollection, selectNetwork.id],
  );
  return (
    <Box paddingX="16px" flex={1}>
      <FlatList
        ListHeaderComponent={() => (
          <Box height="117px" width="full" paddingTop="57px">
            <Box
              flexDirection="column"
              justifyContent="center"
              width="full"
              height="60px"
            >
              <Text typography="Heading">
                {intl.formatMessage({
                  id: 'content__collection',
                })}
              </Text>
            </Box>
          </Box>
        )}
        ListFooterComponent={() => <Box height={`${bottom}px`} />}
        ListEmptyComponent={() => {
          if (isLoading) {
            return (
              <Center w="full" h="20">
                <Spinner size="lg" />
              </Center>
            );
          }
          return (
            <Empty
              title={intl.formatMessage({
                id: 'content__no_results',
              })}
              emoji="🔍"
            />
          );
        }}
        data={listData}
        renderItem={renderItem}
        ItemSeparatorComponent={() => (
          <Divider height="20px" bgColor="surface-subdued" />
        )}
      />
    </Box>
  );
};

const NFTSearchModal: FC = () => {
  const defaultNetwork = useDefaultNetWork();

  const [selectNetwork, updateSearchNetwork] = useState(defaultNetwork);
  const [keyword, setKeyword] = useState<string>('');
  const terms = useDebounce(keyword, 500);

  const { loading, result: collectonList } = useCollectionSearch(
    terms,
    selectNetwork?.id,
  );
  const isLoading = loading || keyword !== terms;

  return (
    <Modal
      size="sm"
      footer={null}
      height="640px"
      headerShown={false}
      staticChildrenProps={{
        flex: 1,
        borderRadius: '24px',
        overflow: 'hidden',
        paddingBottom: '16px',
      }}
    >
      {terms.length > 0 ? (
        <SearchResultList
          isLoading={isLoading}
          selectNetwork={selectNetwork}
          listData={collectonList}
        />
      ) : (
        <DefaultList selectNetwork={selectNetwork} />
      )}
      <Header
        keyword={keyword}
        setKeyword={setKeyword}
        selectNetwork={selectNetwork}
        onSelectNetWork={updateSearchNetwork}
      />
    </Modal>
  );
};

export default NFTSearchModal;
