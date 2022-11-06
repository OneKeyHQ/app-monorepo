import React, { useCallback, useMemo, useState } from 'react';

import {
  Box,
  CustomSkeleton,
  Icon,
  ToggleButtonGroup,
} from '@onekeyhq/components/src';
import { ToggleButtonProps } from '@onekeyhq/components/src/ToggleButtonGroup/ToggleButtonGroup';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { MARKET_FAVORITES_CATEGORYID } from '@onekeyhq/kit/src/store/reducers/market';

import { MARKET_FAKE_SKELETON_CATEGORY_ARRAY } from '../../config';
import { useMarketSelectedCategoryId } from '../../hooks/useMarketCategory';
import { MarketCategoryHeadProps } from '../../types';

const MarketCategoryToggles: React.FC<MarketCategoryHeadProps> = ({
  categorys,
}) => {
  const selectedCategoryId = useMarketSelectedCategoryId();
  const defaultSelectedIndex = useMemo(() => {
    if (selectedCategoryId) {
      return categorys.findIndex((c) => c.categoryId === selectedCategoryId);
    }
    const findIndex = categorys.findIndex((c) => c.defaultSelected);
    return findIndex !== -1 ? findIndex : 0;
  }, [categorys, selectedCategoryId]);

  const buttons = useMemo(
    () =>
      categorys.map((c) => {
        const buttonData: ToggleButtonProps = {
          text: c.name ?? '',
        };
        if (c.categoryId === MARKET_FAVORITES_CATEGORYID) {
          buttonData.leftComponentRender = () => (
            <Icon name="StarSolid" color="icon-warning" size={20} />
          );
          buttonData.text = '';
        }
        return buttonData;
      }),
    [categorys],
  );

  console.log('categorys = ', categorys);

  const [toggleIndex, setToggleIndex] = useState(() => defaultSelectedIndex);

  const toggleCategory = useCallback(
    (index: number) => {
      setToggleIndex(index);
      const selectedCategory = categorys[index];
      if (selectedCategory) {
        backgroundApiProxy.serviceMarket.toggleCategory({
          categoryId: selectedCategory.categoryId,
          coingeckoIds: selectedCategory.coingeckoIds,
          type: selectedCategory.type,
        });
      }
    },
    [categorys],
  );

  return (
    <Box>
      <Box flex={1} width="full">
        {categorys.length > 0 ? (
          <ToggleButtonGroup
            leftIconSize={0}
            buttons={buttons}
            selectedIndex={toggleIndex}
            onButtonPress={toggleCategory}
            bg="background-default"
          />
        ) : (
          <Box flex={1} width="full" flexDirection="row">
            {MARKET_FAKE_SKELETON_CATEGORY_ARRAY.map((_v, i) => (
              <Box
                mr="6"
                w="10"
                h="4"
                borderRadius="9999px"
                overflow="hidden"
                key={i}
              >
                <CustomSkeleton />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default React.memo(MarketCategoryToggles);
