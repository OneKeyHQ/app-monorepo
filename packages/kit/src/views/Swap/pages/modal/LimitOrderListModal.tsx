import { useMemo, useState } from 'react';

import { SegmentControl, YStack } from '@onekeyhq/components';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ESwapLimitOrderStatus } from '@onekeyhq/shared/types/swap/types';

import LimitOrderList from '../components/LimitOrderList';

const LimitOrderListModal = () => {
  const [{ swapLimitOrders }] = useInAppNotificationAtom();

  const [limitOrderSelectedTab, setLimitOrderSelectedTab] = useState<
    'open' | 'history'
  >('open');

  const orderData = useMemo(() => {
    if (limitOrderSelectedTab === 'open') {
      return swapLimitOrders.filter(
        (order) => order.status === ESwapLimitOrderStatus.OPEN,
      );
    }
    return swapLimitOrders;
  }, [limitOrderSelectedTab, swapLimitOrders]);

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
      <LimitOrderList data={orderData} />
    </YStack>
  );
};

export default LimitOrderListModal;
