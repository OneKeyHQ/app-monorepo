import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Pressable,
  Typography,
  Divider,
  Icon,
} from '@onekeyhq/components/src';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { MarketCategoryHeadProps, MarketCategoryToggleItem } from '../../types';
import MarketCategoryToggleComponent from '../MarketCategoryToggleComponent';
import { MARKET_FAVORITES_CATEGORYID } from '../../../../store/reducers/market';

const MarketCategoryToggles: React.FC<MarketCategoryHeadProps> = ({
  categorys,
}) => {
  const [toggleItems, setToggleItems] = useState<MarketCategoryToggleItem[]>(
    () => [],
  );
  const toggleCategory = useCallback((item: MarketCategoryToggleItem) => {
    backgroundApiProxy.serviceMarket.toggleCategory({
      categoryId: item.categoryId,
      coingeckoIds: item.coingeckoIds,
      type: item.type,
    });
  }, []);

  useEffect(() => {
    setToggleItems(() =>
      categorys.map((c) => {
        if (c.categoryId === MARKET_FAVORITES_CATEGORYID) {
          return {
            ...c,
            leftIconName: 'StarSolid',
          };
        }
        return c;
      }),
    );
  }, [categorys]);
  // todo 分类列表组件
  return (
    <Box>
      <Box flex={1} width="full" mt="4">
        {/* {categorys.map((catogory) =>
            catogory.name === 'favorite' ? (
              <IconButton iconSize={20} name="StarSolid" />
            ) : (
              <Button borderRadius="12px"> {catogory.name}</Button>
            ),
          )} */}
        <MarketCategoryToggleComponent
          items={toggleItems}
          onSelect={toggleCategory}
        />
      </Box>
    </Box>
  );
};

export default React.memo(MarketCategoryToggles);
