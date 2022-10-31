import React, { useCallback } from 'react';

import { ListRenderItem } from 'react-native';

import { Box, FlatList, useSafeAreaInsets } from '@onekeyhq/components';
import { NFTMarketCapCollection } from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../../../../CollectionLogo';
import PriceText from '../../../../PriceText';
import { useStatsListContext } from '../../context';
import EmptyView from '../../EmptyView';
import StatsItemCell from '../../StatsItemCell';

const Mobile = ({ listData }: { listData: NFTMarketCapCollection[] }) => {
  const context = useStatsListContext()?.context;
  const { bottom } = useSafeAreaInsets();

  const renderItem: ListRenderItem<NFTMarketCapCollection> = useCallback(
    ({ item, index }) => (
      <StatsItemCell
        height="56px"
        paddingX="16px"
        index={`${index + 1}`}
        title={item.contract_name}
        subTitle={item.floor_price ? `Floor ${item.floor_price}` : ''}
        logoComponent={
          <CollectionLogo src={item.logo_url} width="56px" height="56px" />
        }
        rightComponents={[
          <PriceText
            price={item.market_cap}
            networkId={context?.selectedNetwork?.id}
            textAlign="right"
            numberOfLines={1}
            typography="Body1Strong"
          />,
        ]}
      />
    ),
    [context?.selectedNetwork?.id],
  );

  if (listData === undefined || listData?.length === 0 || context?.loading) {
    return (
      <EmptyView
        isTab={context?.isTab}
        numberOfData={context?.isTab ? 5 : 10}
      />
    );
  }

  return (
    <FlatList
      data={listData}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <Box height="20px" />}
      ListFooterComponent={() =>
        context?.isTab === false ? <Box height={`${bottom}px`} /> : null
      }
      keyExtractor={(item, index) =>
        `${item.contract_address as string}${index}`
      }
    />
  );
};
export default Mobile;
