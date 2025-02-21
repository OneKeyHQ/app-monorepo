import { useCallback, useState } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { SegmentControl, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import LimitOrderList from '../components/LimitOrderList';

const LimitOrderListModal = () => {
  const [{ swapLimitOrders }] = useInAppNotificationAtom();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [limitOrderSelectedTab, setLimitOrderSelectedTab] = useState<
    'open' | 'history'
  >('open');
  const onClickCell = useCallback(
    (item: IFetchLimitOrderRes) => {
      navigation.push(EModalSwapRoutes.LimitOrderDetail, {
        orderId: item.orderId,
        orderItem: item,
      });
    },
    [navigation],
  );

  return (
    <YStack px="$4" pt="$2" gap="$4">
      <SegmentControl
        w="100%"
        fullWidth
        options={[
          { label: 'Open orders', value: 'open' },
          { label: 'Order history', value: 'history' },
        ]}
        onChange={(value) => {
          setLimitOrderSelectedTab(value as 'open' | 'history');
        }}
        value={limitOrderSelectedTab}
      />

      <LimitOrderList
        onClickCell={onClickCell}
        data={swapLimitOrders}
        type={limitOrderSelectedTab}
      />
    </YStack>
  );
};

export default LimitOrderListModal;
