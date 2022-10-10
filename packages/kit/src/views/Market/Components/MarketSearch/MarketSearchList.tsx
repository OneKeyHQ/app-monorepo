import React, { FC, useCallback } from 'react';
import MarketTokenCell from '../MarketList/MarketTokenCell';
import MarketSearchDesktopCell from './MarketSearchDesktopCell';
import { ListHeadTagsForSearch } from '../../config';
import {
  useIsVerticalLayout,
  FlatList,
  Box,
  Empty,
} from '@onekeyhq/components/src';
import { MarketTokenItem } from '../../../../store/reducers/market';

const MarketSearchList: FC<{
  data?: string[];
  onPress: (marketTokenId: MarketTokenItem) => void;
}> = ({ data, onPress }) => {
  const isVertical = useIsVerticalLayout();
  const renderItem = useCallback(
    ({ item }) =>
      isVertical ? (
        <MarketTokenCell
          marketTokenId={item}
          onPress={onPress}
          headTags={ListHeadTagsForSearch}
        />
      ) : (
        <MarketSearchDesktopCell onPress={onPress} marketTokenId={item} />
      ),
    [isVertical, onPress],
  );
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      ListEmptyComponent={
        <Empty
          isLoading
          title="No History"
          subTitle="Search for token name or contract address"
          emoji="🕓"
        />
      }
    />
  );
};

export default React.memo(MarketSearchList);
