import { useCallback, useEffect } from 'react';
import type { FC } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

import type { LimitOrderTransactionDetails } from '../../typings';

type PendingLimitOrderProps = {
  limitOrder: LimitOrderTransactionDetails;
  stopInterval?: boolean;
};

const PendingLimitOrder: FC<PendingLimitOrderProps> = ({
  limitOrder,
  stopInterval,
}) => {
  const onQuery = useCallback(() => {
    backgroundApiProxy.serviceLimitOrder.queryOrderStateProcess(limitOrder);
  }, [limitOrder]);
  useEffect(() => {
    onQuery();
    if (stopInterval) {
      return;
    }
    const timer = setInterval(onQuery, 30 * 1000);
    return () => {
      clearInterval(timer);
    };
    // eslint-disable-next-line
  }, []);
  return null;
};

export default PendingLimitOrder;
