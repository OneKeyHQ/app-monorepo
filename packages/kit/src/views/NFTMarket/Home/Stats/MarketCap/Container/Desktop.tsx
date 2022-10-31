import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { Box, Divider, FlatList, Text } from '@onekeyhq/components';
import { NFTMarketCapCollection } from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../../../../CollectionLogo';
import PriceText from '../../../../PriceText';
import { useStatsListContext } from '../../context';
import EmptyView from '../../EmptyView';
import StatsItemCell from '../../StatsItemCell';

const ListHeaderComponent = () => {
  const intl = useIntl();

  return (
    <Box>
      <StatsItemCell
        mb="8px"
        height="16px"
        leftComponent={
          <Text color="text-subdued" typography="Subheading">
            {intl.formatMessage({
              id: 'content__collection',
            })}
          </Text>
        }
        rightComponents={[
          <Text
            textAlign="right"
            numberOfLines={1}
            typography="Subheading"
            color="text-subdued"
          >
            {intl.formatMessage({
              id: 'content__market_cap',
            })}
          </Text>,
        ]}
      />
      <Divider />
    </Box>
  );
};

const Desktop = ({ listData }: { listData: NFTMarketCapCollection[] }) => {
  const context = useStatsListContext()?.context;

  const renderItem: ListRenderItem<NFTMarketCapCollection> = useCallback(
    ({ item, index }) => (
      <StatsItemCell
        height="64px"
        index={`${index + 1}`}
        title={item.contract_name}
        subTitle={item.floor_price ? `Floor ${item.floor_price}` : ''}
        rightComponents={[
          <PriceText
            price={item.market_cap}
            networkId={context?.selectedNetwork?.id}
            textAlign="right"
            numberOfLines={1}
            typography="Body1Strong"
          />,
        ]}
        logoComponent={
          <CollectionLogo src={item.logo_url} width="40px" height="40px" />
        }
      />
    ),
    [context?.selectedNetwork?.id],
  );

  if (listData === undefined || listData?.length === 0 || context?.loading) {
    return (
      <EmptyView
        ListHeaderComponent={ListHeaderComponent}
        isTab={context?.isTab}
        numberOfData={context?.isTab ? 5 : 10}
      />
    );
  }
  return (
    <FlatList
      ListHeaderComponent={ListHeaderComponent}
      data={listData}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <Divider />}
      keyExtractor={(item, index) =>
        `${item.contract_address as string}${index}`
      }
    />
  );
};
export default Desktop;
