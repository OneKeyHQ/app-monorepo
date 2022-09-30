import React, { useState } from 'react';

import {
  Box,
  ICON_NAMES,
  Icon,
  Pressable,
  ScrollView,
  Typography,
} from '@onekeyhq/components/src';

import { useAppSelector } from '../../../hooks/redux';
import { MarketCategory } from '../../../store/reducers/market';

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

export const MarketCategoryToggleComponent: React.FC<
  MarketCategoryToggleComponentProp
> = ({ items, onSelect }) => {
  const [selected, setSelected] = useState(() => {});
  const currentCategory: MarketCategory | undefined = useAppSelector(
    (s) => s.market.currentCategory,
  );
  console.log('MarketCategoryToggleComponent--', currentCategory);
  return (
    <Box width="full" flexDirection="row">
      <ScrollView>
        <Box width="full" flexDirection="row">
          {items.map((i) => (
            <Pressable
              p="2"
              key={i.categoryId}
              background={
                i.categoryId === currentCategory?.categoryId
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
              {i.categoryId !== 'favorites' ? (
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
