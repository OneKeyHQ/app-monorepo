import React, { FC, useCallback, useState } from 'react';

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
import { Collection } from '@onekeyhq/engine/src/types/nft';

import { useDebounce } from '../../../hooks';
import ChainSelector from '../ChainSelector';
import CollectionLogo from '../CollectionLogo';
import { useDefaultNetWork } from '../Home/hook';
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

const NFTSearchModal: FC = () => {
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<
        SearchNFTCollectionRoutesParams,
        SearchNFTCollectionRoutes.SearchModal
      >
    >();
  const { onSelectCollection } = route.params;

  const defaultNetwork = useDefaultNetWork();

  const [selectNetwork, updateSearchNetwork] = useState(defaultNetwork);
  const [keyword, setKeyword] = useState<string>('');
  const terms = useDebounce(keyword, 500);

  const { loading, result: collectonList } = useCollectionSearch(
    terms,
    selectNetwork.id,
  );
  const isLoading = loading || keyword !== terms;
  const { bottom } = useSafeAreaInsets();

  const renderItem: ListRenderItem<Collection> = useCallback(
    ({ item }) => {
      console.log();
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
    <Modal
      size="sm"
      footer={null}
      height="640px"
      headerShown={false}
      staticChildrenProps={{
        flex: 1,
      }}
    >
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
                {collectonList.length > 0 ? (
                  <Text typography="Heading">
                    {intl.formatMessage({
                      id: 'content__collection',
                    })}
                  </Text>
                ) : null}
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
          data={collectonList}
          renderItem={renderItem}
          ItemSeparatorComponent={() => (
            <Divider height="20px" bgColor="surface-subdued" />
          )}
        />
      </Box>
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
