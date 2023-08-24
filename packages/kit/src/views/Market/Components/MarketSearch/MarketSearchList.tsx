import type { FC } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Empty,
  FlatList,
  Icon,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { MarketTokenItem } from '@onekeyhq/kit/src/store/reducers/market';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

import { ListHeadTagsForSearch, SUBMIT_TOKEN_URL } from '../../config';
import { useMarketSearchCategoryList } from '../../hooks/useMarketCategory';
import MarketTokenCell from '../MarketList/MarketTokenCell';

import MarketSearchDesktopCell from './MarketSearchDesktopCell';

const MarketSearchList: FC<{
  categoryId?: string;
  data?: string[];
  onPress: (marketTokenId: MarketTokenItem) => void;
}> = ({ categoryId, data, onPress }) => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const isVertical = useIsVerticalLayout();
  const categorys = useMarketSearchCategoryList();
  const [newData, setNewData] = useState<string[]>(data ?? []);
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

  useEffect(() => {
    if (data) {
      setNewData(data);
    }
  }, [data]);

  useEffect(() => {
    if (categoryId) {
      const category = categorys.find((c) => c.categoryId === categoryId);
      if (
        category &&
        category?.coingeckoIds &&
        category?.coingeckoIds?.length > 0
      ) {
        setNewData(category.coingeckoIds);
      }
    }
  }, [categoryId, categorys]);

  return (
    <FlatList
      data={newData}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: bottom }}
      showsVerticalScrollIndicator={false}
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
            openUrl(
              SUBMIT_TOKEN_URL,
              intl.formatMessage({ id: 'action__submit_token' }),
              { modalMode: true },
            );
          }}
          actionProps={{
            type: 'basic',
            size: 'lg',
            rightIcon: <Icon name="ArrowTopRightOnSquareMini" size={20} />,
            borderRadius: '12px',
            borderWidth: '1px',
          }}
        />
      }
    />
  );
};

export default memo(MarketSearchList);
