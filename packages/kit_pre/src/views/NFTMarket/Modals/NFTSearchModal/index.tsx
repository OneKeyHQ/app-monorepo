import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Center,
  Empty,
  HStack,
  KeyboardAvoidingView,
  List,
  ListItem,
  Modal,
  ScrollView,
  Searchbar,
  Spinner,
  Text,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import NavigationButton from '@onekeyhq/components/src/Modal/Container/Header/NavigationButton';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type {
  Collection,
  NFTMarketRanking,
} from '@onekeyhq/engine/src/types/nft';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useDebounce } from '../../../../hooks';
import ChainSelector from '../../ChainSelector';
import CollectionLogo from '../../CollectionLogo';
import { useDefaultNetWork } from '../../Home/hook';
import RankingList from '../../Home/Stats/Ranking/Container/Mobile';

import { useCollectionSearch } from './useCollectionSearch';

import type { NFTMarketRoutes, NFTMarketRoutesParams } from '../type';
import type { RouteProp } from '@react-navigation/core';
import type { ListRenderItem } from 'react-native';

const Header: FC<{
  keyword: string;
  setKeyword: (keyword: string) => void;
  selectNetwork: Network;
  onSelectNetWork: (network: Network) => void;
}> = ({ keyword, setKeyword, selectNetwork, onSelectNetWork }) => {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<NFTMarketRoutesParams, NFTMarketRoutes.SearchModal>>();
  const { ethOnly } = route.params;

  const modalClose = useModalClose();
  return (
    <HStack
      alignItems="center"
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderBottomColor="border-subdued"
      pl={{ base: '4px', md: '12px' }}
      pr={{ base: '16px', md: '24px' }}
      h="57px"
    >
      <Searchbar
        autoFocus
        flex={1}
        w="auto"
        bgColor="transparent"
        borderWidth={0}
        focusOutlineColor="transparent"
        placeholder={`${intl.formatMessage({
          id: 'form__nft_search_placeholder',
        })}...`}
        value={keyword}
        onClear={() => {
          setKeyword('');
        }}
        onChangeText={(text) => {
          setKeyword(text);
        }}
      />
      <Box
        h="20px"
        borderLeftWidth={StyleSheet.hairlineWidth}
        borderLeftColor="border-subdued"
        mr="12px"
      />
      <HStack space="16px" alignItems="center">
        {!!ethOnly === false && (
          <ChainSelector
            selectedNetwork={selectNetwork}
            onChange={(n) => {
              onSelectNetWork(n);
            }}
          />
        )}
        {!platformEnv.isNativeIOS && <NavigationButton onPress={modalClose} />}
      </HStack>
    </HStack>
  );
};

type Props = {
  isLoading?: boolean;
  listData?: Collection[];
  selectNetwork: Network;
};

const DefaultList: FC<Props> = ({ selectNetwork }) => {
  const { serviceNFT } = backgroundApiProxy;
  const intl = useIntl();
  const route =
    useRoute<RouteProp<NFTMarketRoutesParams, NFTMarketRoutes.SearchModal>>();
  const { onSelectCollection } = route.params;
  const [listData, updateListData] = useState<NFTMarketRanking[]>([]);
  useEffect(() => {
    (async () => {
      const data = await serviceNFT.getMarketRanking({
        chain: selectNetwork?.id,
        time: '1d',
      });
      if (data) {
        updateListData(data.slice(0, 10));
      }
    })();
  }, [selectNetwork?.id, serviceNFT]);

  return (
    <RankingList
      onSelectCollection={onSelectCollection}
      selectNetwork={selectNetwork}
      headerProps={{
        title: intl.formatMessage({
          id: 'content__ranking',
        }),
        actions: [
          {
            label: intl.formatMessage(
              {
                id: 'content__int_day_volume',
              },
              { 0: 1 },
            ),
            onPress: () => {},
          },
        ],
      }}
      listData={listData}
    />
  );
};

const SearchResultList: FC<Props> = ({
  isLoading,
  listData,
  selectNetwork,
}) => {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<NFTMarketRoutesParams, NFTMarketRoutes.SearchModal>>();
  const { onSelectCollection } = route.params;
  const renderItem: ListRenderItem<Collection> = useCallback(
    ({ item }) => {
      const items = item?.itemsTotal ?? 0;
      const floorPrice = item?.floorPrice
        ? `${item?.floorPrice} ${item.priceSymbol ?? ''}`
        : undefined;
      return (
        <ListItem
          onPress={() => {
            onSelectCollection({
              networkId: selectNetwork.id,
              contractAddress: item.contractAddress as string,
            });
          }}
        >
          <ListItem.Column>
            <CollectionLogo
              src={item.logoUrl}
              width="56px"
              height="56px"
              verified={item.openseaVerified}
            />
          </ListItem.Column>
          <ListItem.Column
            flex={1}
            text={{
              label: item.name,
              labelProps: { numberOfLines: 1 },
              description: (
                <HStack space="8px" alignItems="center">
                  <Text typography="Body2" color="text-subdued">
                    {intl.formatMessage(
                      {
                        id: 'content__int_items',
                      },
                      {
                        0: items || '–',
                      },
                    )}
                  </Text>
                  <Box bgColor="text-subdued" size="4px" rounded="full" />
                  <Text typography="Body2" color="text-subdued">
                    {intl.formatMessage({
                      id: 'content__floor',
                    })}{' '}
                    {floorPrice || '–'}
                  </Text>
                </HStack>
              ),
            }}
          />
        </ListItem>
      );
    },
    [intl, onSelectCollection, selectNetwork.id],
  );

  const ListEmptyComponent = useCallback(
    () => (
      <Empty
        title={intl.formatMessage({
          id: 'content__no_results',
        })}
        emoji="🔍"
      />
    ),
    [intl],
  );

  const ItemSeparatorComponent = useCallback(() => <Box h="4px" />, []);

  return (
    <>
      {isLoading ? (
        <Center flex={1}>
          <Spinner size="lg" />
        </Center>
      ) : (
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <List
            headerProps={{
              title: intl.formatMessage({
                id: 'content__collection',
              }),
            }}
            ListEmptyComponent={ListEmptyComponent}
            data={listData}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparatorComponent}
          />
        </MotiView>
      )}
    </>
  );
};

const NFTSearchModal: FC = () => {
  const defaultNetwork = useDefaultNetWork();
  const { bottom } = useSafeAreaInsets();

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
        overflow: 'hidden',
      }}
    >
      <Header
        keyword={keyword}
        setKeyword={setKeyword}
        selectNetwork={selectNetwork}
        onSelectNetWork={updateSearchNetwork}
      />
      <KeyboardAvoidingView flex={1}>
        <ScrollView
          flex={1}
          p={{ base: '16px', md: '24px' }}
          contentContainerStyle={{ flex: 1, paddingBottom: bottom }}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default NFTSearchModal;
