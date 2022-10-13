import React, { useState, useCallback, useMemo } from 'react';
import { Box, Icon, ToggleButtonGroup } from '@onekeyhq/components/src';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { MarketCategoryHeadProps } from '../../types';

import { MARKET_FAVORITES_CATEGORYID } from '../../../../store/reducers/market';
import { ToggleButtonProps } from '@onekeyhq/components/src/ToggleButtonGroup/ToggleButtonGroup';

const MarketCategoryToggles: React.FC<MarketCategoryHeadProps> = ({
  categorys,
}) => {
  const defaultSelectedIndex = useMemo(() => {
    const findIndex = categorys.findIndex((c) => c.defaultSelected);
    return findIndex !== -1 ? findIndex : 0;
  }, [categorys]);

  const buttons = useMemo(
    () =>
      categorys.map((c) => {
        const buttonData: ToggleButtonProps = {
          text: c.name ?? '',
        };
        if (c.categoryId === MARKET_FAVORITES_CATEGORYID) {
          buttonData.leftComponent = () => (
            <Icon name="StarSolid" color="icon-warning" size={20} />
          );
          buttonData.text = '';
        }
        return buttonData;
      }),
    [categorys],
  );

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
        <ToggleButtonGroup
          buttons={buttons}
          selectedIndex={toggleIndex}
          onButtonPress={toggleCategory}
        />
      </Box>
    </Box>
  );
};

export default React.memo(MarketCategoryToggles);
