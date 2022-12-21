import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { ListItem, Modal, NetImage } from '@onekeyhq/components';
import type { MarketPlace } from '@onekeyhq/engine/src/types/nft';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

import type { NFTMarketRoutes, NFTMarketRoutesParams } from '../type';
import type { RouteProp } from '@react-navigation/core';
import type { ListRenderItem } from 'react-native';

const MarketPlaceList: FC = () => {
  const navigation = useNavigation();
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<NFTMarketRoutesParams, NFTMarketRoutes.MarketPlaceScreen>
    >();
  const { selectMarket, onSelect } = route.params;
  const { serviceNFT } = backgroundApiProxy;

  const [listData, updateListData] = useState<MarketPlace[]>([]);

  useEffect(() => {
    (async () => {
      const data = await serviceNFT.getMarketPlaces({
        chain: OnekeyNetwork.eth,
      });
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
        <ListItem.Column>
          <NetImage
            width="40px"
            height="40px"
            borderRadius="20px"
            src={item.logoUrl}
          />
        </ListItem.Column>
        <ListItem.Column flex={1} text={{ label: item.name }} />
        {selectMarket?.name === item.name ? (
          <ListItem.Column
            icon={{ name: 'CheckCircleSolid', color: 'interactive-default' }}
          />
        ) : null}
      </ListItem>
    ),
    [navigation, onSelect, selectMarket?.name],
  );

  return (
    <Modal
      size="xs"
      height="560px"
      header={intl.formatMessage({ id: 'form__platform' })}
      footer={null}
      flatListProps={{
        height: '420px',
        data: listData,
        // @ts-ignore
        renderItem,
        keyExtractor: (item) => (item as MarketPlace).name,
      }}
    />
  );
};

export default MarketPlaceList;
