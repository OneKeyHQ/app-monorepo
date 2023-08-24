import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, CustomSkeleton, ToggleButtonGroup } from '@onekeyhq/components';
import type { ToggleButtonProps } from '@onekeyhq/components/src/ToggleButtonGroup/ToggleButtonGroup';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { SimplyMarketCategory } from '@onekeyhq/kit/src/store/reducers/market';
import { MARKET_FAVORITES_CATEGORYID } from '@onekeyhq/kit/src/store/reducers/market';

import { MARKET_FAKE_SKELETON_CATEGORY_ARRAY } from '../../config';
import { useMarketSelectedCategoryId } from '../../hooks/useMarketCategory';

import type { MarketCategoryHeadProps } from '../../types';

export const switchCategory = (
  index: number,
  categories: SimplyMarketCategory[],
) => {
  const selectedCategory = categories[index];
  if (selectedCategory) {
    backgroundApiProxy.serviceMarket.toggleCategory(
      selectedCategory.categoryId,
    );
  }
};
const MarketCategoryToggles: FC<MarketCategoryHeadProps> = ({ categories }) => {
  const selectedCategoryId = useMarketSelectedCategoryId();
  const defaultSelectedIndex = useMemo(() => {
    if (selectedCategoryId) {
      return categories.findIndex((c) => c.categoryId === selectedCategoryId);
    }
    const findIndex = categories.findIndex((c) => c.defaultSelected);
    return findIndex !== -1 ? findIndex : 0;
  }, [categories, selectedCategoryId]);
  const intl = useIntl();
  const buttons = useMemo(
    () =>
      categories.map((c) => {
        const buttonData: ToggleButtonProps = {
          text: c.name ?? '',
        };
        if (c.categoryId === MARKET_FAVORITES_CATEGORYID) {
          // buttonData.leftIcon = 'StarMini';
          // buttonData.leftIconSelectedColor = 'icon-warning';
          buttonData.text = intl.formatMessage({ id: 'form__Watchlist' });
        }
        return buttonData;
      }),
    [categories, intl],
  );

  const toggleCategory = useCallback(
    (index: number) => {
      switchCategory(index, categories);
    },
    [categories],
  );
  return (
    <Box h="32px">
      <Box flex={1} width="full">
        {categories.length > 0 ? (
          <ToggleButtonGroup
            leftIconSize={0}
            buttons={buttons}
            selectedIndex={defaultSelectedIndex}
            onButtonPress={toggleCategory}
            bg="background-default"
          />
        ) : (
          <Box flex={1} width="full" flexDirection="row">
            {MARKET_FAKE_SKELETON_CATEGORY_ARRAY.map((_v, i) => (
              <Box
                mr="6"
                w="10"
                h="8"
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

export default memo(MarketCategoryToggles);
