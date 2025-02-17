import { useMemo } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { useSwapTypeSwitchAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ESwapLimitOrderStatus,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

const LimitOrderOpenItem = () => {
  const [{ swapLimitOrders }] = useInAppNotificationAtom();
  const openLimitOrder = useMemo(
    () =>
      swapLimitOrders.filter(
        (order) => order.status === ESwapLimitOrderStatus.OPEN,
      ),
    [swapLimitOrders],
  );
  const [swapType] = useSwapTypeSwitchAtom();
  return openLimitOrder.length > 0 && swapType === ESwapTabSwitchType.LIMIT ? (
    <XStack
      justifyContent="space-between"
      py="$3.5"
      px="$4"
      bg="$bgSubdued"
      borderRadius="$3"
    >
      <XStack gap="$2">
        <Icon size={16} name="ClockTimeHistoryOutline" color="$iconSubdued" />
        <SizableText size="$bodyMdMedium">
          {`${openLimitOrder.length} open limit order`}
        </SizableText>
      </XStack>
      <Icon size={20} name="ArrowRightOutline" color="$iconSubdued" />
    </XStack>
  ) : null;
};

export default LimitOrderOpenItem;
