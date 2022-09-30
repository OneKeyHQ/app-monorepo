import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Pressable,
  Typography,
  Divider,
  Icon,
} from '@onekeyhq/components/src';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { MarketCategoryHeadProps, MarketCategoryToggleItem } from '../types';
import { MarketCategoryToggleComponent } from './MarketCategoryToggleComponent';

const ListHeaderComponent: React.FC<MarketCategoryHeadProps> = ({
  categorys,
}) => {
  // 根据屏幕大小返回表头
  const [toggleItems, setToggleItems] = useState<MarketCategoryToggleItem[]>(
    () => [],
  );
  const toggleCategory = useCallback((item: MarketCategoryToggleItem) => {
    console.log('item-', item);
    backgroundApiProxy.serviceMarket.toggleCategory({
      categoryId: item.categoryId,
      coingeckoIds: item.coingeckoIds,
      type: item.type,
    });
  }, []);

  useEffect(() => {
    console.log('ListHeaderComponent--useEffect-categorys:', categorys);
    setToggleItems(() =>
      categorys.map((c) => {
        if (c.categoryId === 'favorites') {
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
      <Box flex={1} width="full" height="32px" mt="4">
        <Box flexDirection="row" alignItems="center">
          <Pressable
            flexDirection="row"
            justifyContent="flex-end"
            alignSelf="center"
            width="52px"
          >
            <Typography.Subheading>#</Typography.Subheading>
            <Icon name="ChevronDownSolid" size={16} />
          </Pressable>
          <Pressable
            flexDirection="row"
            alignSelf="center"
            width="100px"
            ml="6"
          >
            <Typography.Subheading>NAME</Typography.Subheading>
            <Icon name="ChevronDownSolid" size={16} />
          </Pressable>
          <Pressable
            flexDirection="row"
            justifyContent="flex-end"
            alignSelf="center"
            width="100px"
            ml="6"
          >
            <Typography.Subheading>PRICE</Typography.Subheading>
            <Icon name="ChevronDownSolid" size={16} />
          </Pressable>
          <Pressable
            flexDirection="row"
            justifyContent="flex-end"
            alignSelf="center"
            width="100px"
            ml="6"
          >
            <Typography.Subheading>24H%</Typography.Subheading>
            <Icon name="ChevronDownSolid" size={16} />
          </Pressable>
          <Pressable
            flexDirection="row"
            justifyContent="flex-end"
            alignSelf="center"
            width="120px"
            ml="6"
          >
            <Typography.Subheading>24HVOLUME</Typography.Subheading>
            <Icon name="ChevronDownSolid" size={16} />
          </Pressable>
          <Pressable
            flexDirection="row"
            justifyContent="flex-end"
            alignSelf="center"
            width="128px"
            ml="6"
          >
            <Typography.Subheading>MARKETCAP</Typography.Subheading>
            <Icon name="ChevronDownSolid" size={16} />
          </Pressable>
          <Pressable
            flexDirection="row"
            justifyContent="flex-end"
            alignSelf="center"
            width="100px"
            ml="6"
          >
            <Typography.Subheading>LAST 7 DAY</Typography.Subheading>
            <Icon name="ChevronDownSolid" size={16} />
          </Pressable>
        </Box>
        <Divider mt="2" />
      </Box>
    </Box>
  );
};

export default React.memo(ListHeaderComponent);
