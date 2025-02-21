import { SizableText, YStack } from '@onekeyhq/components';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import LimitOrderCard from '../../components/LimitOrderCard';

const LimitOrderCancelDialog = ({ item }: { item: IFetchLimitOrderRes }) => (
  <YStack gap="$4">
    <YStack gap="$2">
      <SizableText size="$bodyLg">
        Are you sure you want to cancel this limit order
      </SizableText>
      <SizableText size="$bodyLg">
        {`${item.orderId.slice(0, 6)}...${item.orderId.slice(-4)}`}
      </SizableText>
    </YStack>
    <LimitOrderCard item={item} hiddenCancelIcon />
    <SizableText size="$bodyMd">
      This is an off-chain cancellation. It requires a signature and are free.
    </SizableText>
  </YStack>
);

export default LimitOrderCancelDialog;
