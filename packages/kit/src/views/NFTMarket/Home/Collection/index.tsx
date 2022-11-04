import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  FlatList,
  NetImage,
  Pressable,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import ScrollableButtonGroup from '@onekeyhq/components/src/ScrollableButtonGroup/ScrollableButtonGroup';
import { Collection } from '@onekeyhq/engine/src/types/nft';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import PriceText from '../../PriceText';
import { useCollectionDetail } from '../hook';

import EmptyView from './EmptyView';

type Props = {
  listData: Collection[];
  onSelectCollection: (collection: Collection) => void;
};
const Mobile: FC<Props> = ({ listData, onSelectCollection }) => {
  const intl = useIntl();

  const renderItem: ListRenderItem<Collection> = useCallback(
    ({ item }) => {
      const { bannerUrl, contractName, floorPrice, chain } = item;
      return (
        <Pressable
          onPress={() => {
            onSelectCollection(item);
          }}
          mr="16px"
        >
          <Box borderRadius="12px" overflow="hidden">
            <NetImage width="280px" height="280px" src={bannerUrl} />
          </Box>
          <Text mt="8px" typography="Body1Strong" numberOfLines={1}>
            {contractName}
          </Text>
          {floorPrice && (
            <PriceText
              prefix={intl.formatMessage({
                id: 'content__floor',
              })}
              price={floorPrice}
              networkId={chain}
              mt="4px"
              typography="Body2"
              color="text-subdued"
            />
          )}
        </Pressable>
      );
    },
    [intl, onSelectCollection],
  );

  return (
    <Box>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.contractAddress as string}
      />
    </Box>
  );
};
const Desktop: FC<Props> = ({ listData, onSelectCollection }) => {
  const ref = useRef(null);
  const intl = useIntl();

  const renderItem = useCallback(
    (item: Collection) => {
      const { bannerUrl, contractName, floorPrice, chain } = item;
      return (
        <Pressable
          onPress={() => {
            onSelectCollection(item);
          }}
          mr="16px"
        >
          <Box
            width="220px"
            height="146px"
            borderRadius="12px"
            overflow="hidden"
          >
            <NetImage width="280px" height="146px" src={bannerUrl} />
          </Box>
          <Text mt="8px" typography="Body1Strong" numberOfLines={1}>
            {contractName}
          </Text>
          {floorPrice && (
            <PriceText
              prefix={intl.formatMessage({
                id: 'content__floor',
              })}
              price={floorPrice}
              networkId={chain}
              mt="4px"
              typography="Body2"
              color="text-subdued"
            />
          )}
        </Pressable>
      );
    },
    [intl, onSelectCollection],
  );

  const Banners = useMemo(
    () => listData.map((item) => renderItem(item)),
    [listData, renderItem],
  );

  return (
    <ScrollableButtonGroup
      justifyContent="center"
      bg="transparent"
      ref={ref}
      style={{
        maxWidth: '100%',
        flexGrow: 0,
        height: 202,
      }}
      leftButtonProps={{
        bgColor: 'action-secondary-default',
        size: 'base',
        circle: true,
      }}
      rightButtonProps={{
        bgColor: 'action-secondary-default',
        size: 'base',
        circle: true,
      }}
    >
      {Banners}
    </ScrollableButtonGroup>
  );
};

const CollectionModule = () => {
  const isSmallScreen = useIsVerticalLayout();
  const { serviceNFT } = backgroundApiProxy;
  const [listData, updateListData] = useState<Collection[]>([]);
  const intl = useIntl();
  const goToCollectionDetail = useCollectionDetail();

  useEffect(() => {
    (async () => {
      const data = await serviceNFT.getMarketCollection();
      updateListData(data);
    })();
  }, [serviceNFT]);

  const onSelectCollection = useCallback(
    (collection: Collection) => {
      goToCollectionDetail({
        networkId: collection.chain as string,
        contractAddress: collection.contractAddress as string,
        collection,
      });
    },
    [goToCollectionDetail],
  );

  const ListView = isSmallScreen ? (
    <Mobile listData={listData} onSelectCollection={onSelectCollection} />
  ) : (
    <Desktop listData={listData} onSelectCollection={onSelectCollection} />
  );

  return (
    <Box>
      <Text typography="Heading" mb="16px">
        {intl.formatMessage({
          id: 'content__notable_collections',
        })}
      </Text>
      {listData.length === 0 ? <EmptyView /> : ListView}
    </Box>
  );
};

export default CollectionModule;
