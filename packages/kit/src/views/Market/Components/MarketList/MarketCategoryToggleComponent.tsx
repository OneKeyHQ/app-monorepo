import React, { useState } from 'react';

import {
  Box,
  ICON_NAMES,
  Icon,
  Pressable,
  ScrollView,
  Typography,
} from '@onekeyhq/components/src';

import { useAppSelector } from '../../../../hooks/redux';
import {
  MarketCategory,
  MARKET_FAVORITES_CATEGORYID,
} from '../../../../store/reducers/market';
import { useMarketSelectedCategoryId } from '../../hooks/useMarketCategory';

export type MarketCategoryToggleItem = MarketCategory & {
  leftIconName?: ICON_NAMES;
  leftIconSize?: number;
  rightIconName?: ICON_NAMES;
  rightIconSize?: number;
};

type MarketCategoryToggleComponentProp = {
  items: MarketCategoryToggleItem[];
  onSelect: (item: MarketCategoryToggleItem) => void;
};

const MarketCategoryToggleComponent: React.FC<
  MarketCategoryToggleComponentProp
> = ({ items, onSelect }) => {
  const selectedCategoryId = useMarketSelectedCategoryId();
  console.log('MarketCategoryToggleComponent--', selectedCategoryId);
  return (
    <Box width="full" flexDirection="row">
      <ScrollView horizontal  showsHorizontalScrollIndicator={false}>
        <Box width="full" flexDirection="row">
          {items.map((i) => (
            <Pressable
              p="2"
              key={i.categoryId}
              background={
                i.categoryId === selectedCategoryId
                  ? 'surface-selected'
                  : 'surface-default'
              }
              onPress={() => {
                onSelect(i);
              }}
              borderRadius="12px"
              ml="2"
            >
              {i.leftIconName ? (
                <Icon size={i.leftIconSize || 20} name={i.leftIconName} />
              ) : null}
              {i.categoryId !== MARKET_FAVORITES_CATEGORYID ? (
                <Typography.Body2Strong color="text-subdued">
                  {i.name}
                </Typography.Body2Strong>
              ) : null}
              {i.rightIconName ? (
                <Icon size={i.rightIconSize || 20} name={i.rightIconName} />
              ) : null}
            </Pressable>
          ))}
        </Box>
      </ScrollView>
    </Box>
  );
};

export default React.memo(MarketCategoryToggleComponent);
