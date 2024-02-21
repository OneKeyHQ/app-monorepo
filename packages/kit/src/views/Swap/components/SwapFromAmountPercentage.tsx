import { memo } from 'react';

import { Button, XStack } from '@onekeyhq/components';
import type { ISwapFromAmountPercentageItem } from '@onekeyhq/shared/types/swap/types';

interface ISwapFromAmountPercentageProps {
  selectItems: ISwapFromAmountPercentageItem[];
  onSelectItem: (item: ISwapFromAmountPercentageItem) => void;
}
const SwapFromAmountPercentage = ({
  selectItems,
  onSelectItem,
}: ISwapFromAmountPercentageProps) => (
  <XStack flex={1}>
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

export default memo(SwapFromAmountPercentage);
