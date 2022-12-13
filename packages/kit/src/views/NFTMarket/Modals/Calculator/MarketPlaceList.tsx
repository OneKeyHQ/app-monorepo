import React, { FC, useCallback, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Icon,
  ListItem,
  Modal,
  NetImage,
  Text,
} from '@onekeyhq/components';
import { MarketPlace } from '@onekeyhq/engine/src/types/nft';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { NFTMarketRoutes, NFTMarketRoutesParams } from '../type';

const MarketPlaceList: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();

  const route =
    useRoute<
      RouteProp<NFTMarketRoutesParams, NFTMarketRoutes.MarketPlaceScreen>
    >();
  const { selectMarket, onSelect } = route.params;
  const { serviceNFT } = backgroundApiProxy;

  const [listData, updateListData] = useState<MarketPlace[]>([]);

  useEffect(() => {
    (async () => {
      const data = await serviceNFT.getMarketPlaces();
      if (data) {
        updateListData(data);
      }
    })();
  }, [serviceNFT]);

  const renderItem: ListRenderItem<MarketPlace> = useCallback(
    ({ item }) => (
      <ListItem
        onPress={() => {
          onSelect?.(item);
          navigation.goBack();
        }}
      >
        <NetImage
          width="40px"
          height="40px"
          borderRadius="20px"
          src={item.logoUrl}
        />
        <Text typography="Body1Strong" flex={1}>
          {item.name}
        </Text>

        {selectMarket?.name === item.name ? (
          <Icon name="CheckCircleSolid" color="interactive-default" />
        ) : null}
      </ListItem>
    ),
    [navigation, onSelect, selectMarket?.name],
  );

  return (
    <Modal
      size="xs"
      height="566px"
      header="Platform"
      footer={null}
      flatListProps={{
        height: '420px',
        data: listData,
        // @ts-ignore
        renderItem,
        keyExtractor: (item) => (item as MarketPlace).name,
        ItemSeparatorComponent: () => <Box height="16px" />,
      }}
    />
  );
};

export default MarketPlaceList;
