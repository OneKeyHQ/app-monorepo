import React, { FC, useCallback } from 'react';

import { useNavigation } from '@react-navigation/native';

import { Tabs } from '@onekeyhq/components/src/CollapsibleTabView';
import { MarketTokenItem } from '../../../../store/reducers/market';
import { useMarketSearchCategoryList } from '../../hooks/useMarketCategory';
import { useMarketSearchSelectedCategory } from '../../hooks/useMarketSearch';
import { useMarketTokenItem } from '../../hooks/useMarketToken';
import MarketTokenCell from '../MarketList/MarketTokenCell';
import { ListHeadTagsForSearch } from '../../config';
import {
  Box,
  FlatList,
  Pressable,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components/src';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

import { HomeRoutes, HomeRoutesParams } from '@onekeyhq/kit/src/routes/types';

import MarketSearchDesktopCell from './MarketSearchDesktopCell';
import MarketSearchList from './MarketSearchList';

const MarketSearchTabs: FC<{
  onPress: (marketTokenItem: MarketTokenItem) => void;
}> = ({ onPress }) => {
  const tabLineColor = useThemeValue('border-subdued');
  const searchCategorys = useMarketSearchCategoryList();
  const selectedTabName = useMarketSearchSelectedCategory();
  return (
    <Tabs.Container
      initialTabName={selectedTabName}
      onTabChange={({ tabName }) => {
        backgroundApiProxy.serviceMarket.setMarketSearchTab(tabName);
      }}
      pagerProps={{ scrollEnabled: false }}
      headerHeight={1}
      headerContainerStyle={{
        shadowOffset: { width: 0, height: 0 },
        shadowColor: 'transparent',
        elevation: 0,
        borderBottomWidth: 1,
        borderBottomColor: tabLineColor,
      }}
    >
      {searchCategorys.map((c) => (
        <Tabs.Tab key={c.categoryId} name={c.name ?? ''}>
          <MarketSearchList data={c.coingeckoIds} onPress={onPress} />
        </Tabs.Tab>
      ))}
    </Tabs.Container>
  );
};

export default React.memo(MarketSearchTabs);
