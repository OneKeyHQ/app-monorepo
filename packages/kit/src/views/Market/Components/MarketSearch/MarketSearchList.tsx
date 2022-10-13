import React, { FC, useCallback } from 'react';
import MarketTokenCell from '../MarketList/MarketTokenCell';
import MarketSearchDesktopCell from './MarketSearchDesktopCell';
import { ListHeadTagsForSearch, SUBMIT_TOKEN_URL } from '../../config';
import {
  useIsVerticalLayout,
  FlatList,
  Box,
  Icon,
  Empty,
} from '@onekeyhq/components/src';
import { MarketTokenItem } from '../../../../store/reducers/market';

import { useWebController } from '../../../Discover/Explorer/Controller/useWebController';

const MarketSearchList: FC<{
  data?: string[];
  onPress: (marketTokenId: MarketTokenItem) => void;
}> = ({ data, onPress }) => {
  const isVertical = useIsVerticalLayout();
  const { gotoSite } = useWebController();
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
          title="No Results"
          subTitle="Try searching with contract address Or submit a new token to us"
          emoji="🔍"
          actionTitle="Submit Token"
          handleAction={() => {
            gotoSite({ url: SUBMIT_TOKEN_URL });
          }}
          actionProps={{
            type: 'basic',
            size: 'lg',
            rightIcon: <Icon name="ExternalLinkSolid" size={20} />,
            borderRadius: '12px',
            borderWidth: '1px',
          }}
        />
      }
    />
  );
};

export default React.memo(MarketSearchList);
