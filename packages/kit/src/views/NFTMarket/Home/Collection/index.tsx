import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  FlatList,
  NetImage,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Collection } from '@onekeyhq/engine/src/types/nft';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import PriceText from '../../PriceText';

import EmptyView from './EmptyView';

const Mobile = ({ listData }: { listData: Collection[] }) => {
  const intl = useIntl();

  const renderItem: ListRenderItem<Collection> = useCallback(
    ({ item }) => {
      const { bannerUrl, contractName, floorPrice, chain } = item;
      return (
        <Box width="280px" height="336px" mr="10px">
          <Box size="280px" borderRadius="12px" overflow="hidden">
            <NetImage width="280px" height="280px" src={bannerUrl} />
          </Box>
          <Text mt="8px" typography="Body1Strong">
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
        </Box>
      );
    },
    [intl],
  );

  return (
    <FlatList
      horizontal
      ListHeaderComponent={() => <Box width="16px" />}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: 16,
      }}
      data={listData}
      renderItem={renderItem}
      keyExtractor={(item) => item.contractAddress as string}
    />
  );
};

const Desktop = ({ listData }: { listData: Collection[] }) => {
  const ref = useRef(null);
  const intl = useIntl();

  const renderItem: ListRenderItem<Collection> = useCallback(
    ({ item }) => {
      const { bannerUrl, contractName, floorPrice, chain } = item;

      return (
        <Box width="220px" height="202px" mr="10px">
          <Box
            width="220px"
            height="146px"
            borderRadius="12px"
            overflow="hidden"
          >
            <NetImage width="280px" height="146px" src={bannerUrl} />
          </Box>
          <Text mt="8px" typography="Body1Strong">
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
        </Box>
      );
    },
    [intl],
  );
  return (
    <>
      <FlatList
        ref={ref}
        horizontal
        onScroll={(e) => {
          console.log('e = ', e);
        }}
        ListHeaderComponent={() => <Box width="16px" />}
        showsHorizontalScrollIndicator
        contentContainerStyle={{
          paddingBottom: 16,
          paddingTop: 16,
        }}
        data={listData}
        renderItem={renderItem}
        keyExtractor={(item) => item.contractAddress as string}
      />
      {/* {platformEnv.isWeb ? (
        <Pressable
          position="absolute"
          bgColor="blue.300"
          width="50px"
          height="50px"
          right={0}
          top="75px"
          onPress={() => {
            console.log('111');
            // console.log('ref = ', ref.current._listRef._scrollMetrics);
          }}
        />
      ) : null} */}
    </>
  );
};

const CollectionModule = () => {
  const isSmallScreen = useIsVerticalLayout();
  const { serviceNFT } = backgroundApiProxy;
  const [listData, updateListData] = useState<Collection[]>([]);
  const intl = useIntl();

  useEffect(() => {
    (async () => {
      const data = await serviceNFT.getMarketCollection();
      updateListData(data);
    })();
  }, [serviceNFT]);

  const ListView = isSmallScreen ? (
    <Mobile listData={listData} />
  ) : (
    <Desktop listData={listData} />
  );

  return (
    <Box>
      <Text pl={isSmallScreen ? '16px' : 0} typography="Heading">
        {intl.formatMessage({
          id: 'content__notable_collections',
        })}
      </Text>
      {listData.length === 0 ? <EmptyView /> : ListView}
    </Box>
  );
};

export default CollectionModule;
