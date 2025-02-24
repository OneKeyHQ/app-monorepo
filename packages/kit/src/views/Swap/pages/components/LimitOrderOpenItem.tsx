import { useMemo } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Icon, SizableText, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSwapTypeSwitchAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import {
  EProtocolOfExchange,
  ESwapLimitOrderStatus,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

const LimitOrderOpenItem = ({
  storeName,
}: {
  storeName: EJotaiContextStoreNames;
}) => {
  const [{ swapLimitOrders }] = useInAppNotificationAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
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
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
      onPress={() => {
        navigation.pushModal(EModalRoutes.SwapModal, {
          screen: EModalSwapRoutes.SwapHistoryList,
          params: {
            type: EProtocolOfExchange.LIMIT,
            storeName,
          },
        });
      }}
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
