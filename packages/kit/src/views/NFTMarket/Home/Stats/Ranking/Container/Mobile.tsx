import React, { useCallback } from 'react';

import { BigNumber } from 'bignumber.js';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import { Box, FlatList, useSafeAreaInsets } from '@onekeyhq/components';
import { NFTMarketRanking } from '@onekeyhq/engine/src/types/nft';

import CollectionLogo from '../../../../CollectionLogo';
import PriceText, { PriceString } from '../../../../PriceText';
import { useStatsListContext } from '../../context';
import EmptyView from '../../EmptyView';
import StatsItemCell from '../../StatsItemCell';

const Mobile = ({ listData }: { listData: NFTMarketRanking[] }) => {
  const context = useStatsListContext()?.context;
  const intl = useIntl();

  const { bottom } = useSafeAreaInsets();
  const renderItem: ListRenderItem<NFTMarketRanking> = useCallback(
    ({ item, index }) => (
      <StatsItemCell
        height="56px"
        paddingX="16px"
        index={`${index + 1}`}
        title={item.contract_name}
        subTitle={PriceString({
          prefix: intl.formatMessage({
            id: 'content__floor',
          }),
          price: item.floor_price,
          networkId: context?.selectedNetwork?.id,
        })}
        logoComponent={
          <CollectionLogo src={item.logo_url} width="56px" height="56px" />
        }
        rightComponents={[
          <PriceText
            price={new BigNumber(item.volume ?? '0')
              .decimalPlaces(2)
              .toString()}
            networkId={context?.selectedNetwork?.id}
            textAlign="right"
            numberOfLines={1}
            typography="Body1Strong"
          />,
        ]}
      />
    ),
    [context?.selectedNetwork?.id, intl],
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
