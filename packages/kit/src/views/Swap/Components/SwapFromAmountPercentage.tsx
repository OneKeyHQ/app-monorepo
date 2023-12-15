import { memo } from 'react';

import { Button, XStack } from '@onekeyhq/components';

import type { ISwapFromAmountPercentageItem } from '../types';

interface ISwapFromAmountPercentageProps {
  selectItems: ISwapFromAmountPercentageItem[];
  onSelectItem: (item: ISwapFromAmountPercentageItem) => void;
}
const SwapFromAmountPercentage = ({
  selectItems,
  onSelectItem,
}: ISwapFromAmountPercentageProps) => {
  console.log('SwapFromAmountPercentage');
  return (
    <XStack>
      {selectItems.map((item) => (
        <Button
          key={item.label}
          onPress={() => {
            onSelectItem(item);
          }}
        >
          {item.label}
        </Button>
      ))}
    </XStack>
  );
};

export default memo(SwapFromAmountPercentage);
