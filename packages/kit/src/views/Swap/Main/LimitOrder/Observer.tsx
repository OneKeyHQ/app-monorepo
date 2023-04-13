import { useEffect } from 'react';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';

export const LimitOrderObserver = () => {
  const activeAccount = useAppSelector((s) => s.limitOrder.activeAccount);
  useEffect(() => {
    if (activeAccount) {
      backgroundApiProxy.serviceLimitOrder.syncAccount({
        accountId: activeAccount?.id,
      });
    }
  }, [activeAccount]);
  return null;
};
