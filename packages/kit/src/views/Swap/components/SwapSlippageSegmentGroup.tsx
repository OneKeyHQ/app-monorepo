import { memo } from 'react';

import { Button, XStack } from 'tamagui';

import { swapSlippageItems } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';
import type { ISwapSlippageSegmentItem } from '@onekeyhq/shared/types/swap/types';

interface ISwapSlippageSegmentGroupProps {
  onSelectSlippage: (slippage: ISwapSlippageSegmentItem) => void;
  currentUsedSlippageItem: ISwapSlippageSegmentItem;
}

const SwapSlippageSegmentGroup = ({
  onSelectSlippage,
  currentUsedSlippageItem,
}: ISwapSlippageSegmentGroupProps) => (
  <XStack>
    {swapSlippageItems.map((item) => (
      <Button
        key={item.key}
        backgroundColor={
          currentUsedSlippageItem.key === item.key ? 'primary' : 'background'
        }
        onPress={() => {
          onSelectSlippage(item);
        }}
      >
        {item.key === ESwapSlippageSegmentKey.AUTO ? 'Auto' : `${item.key}%`}
      </Button>
    ))}
  </XStack>
);

export default memo(SwapSlippageSegmentGroup);
