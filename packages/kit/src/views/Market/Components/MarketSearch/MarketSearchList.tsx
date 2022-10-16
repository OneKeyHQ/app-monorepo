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
import { useIntl } from 'react-intl';

const MarketSearchList: FC<{
  data?: string[];
  onPress: (marketTokenId: MarketTokenItem) => void;
}> = ({ data, onPress }) => {
  const intl = useIntl();
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
          title={intl.formatMessage({ id: 'content__no_results' })}
          subTitle={intl.formatMessage({
            id: 'content__try_searching_with_contract_address_or_submit_a_new_token_to_us',
          })}
          emoji="🔍"
          actionTitle={intl.formatMessage({ id: 'action__submit_token' })}
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
