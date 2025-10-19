import { memo, useCallback, useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { usePreCheckFeeInfo } from '../../../views/SignatureConfirm/hooks/usePreCheckFeeInfo';

function BasicVerifyTxContainer() {
  const { showFeeInfoOverflowConfirm } = usePreCheckFeeInfo({
    accountId: '',
    networkId: '',
  });

  const handler = useCallback(
    async ({ promiseId }: { promiseId: number }) => {
      const isConfirmed = await showFeeInfoOverflowConfirm();

      if (isConfirmed) {
        await backgroundApiProxy.servicePromise.resolveCallback({
          id: promiseId,
          data: true,
        });
      } else {
        await backgroundApiProxy.servicePromise.rejectCallback({
          id: promiseId,
          error: undefined,
        });
      }
    },
    [showFeeInfoOverflowConfirm],
  );

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.doubleConfirmTxFeeInfo, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.doubleConfirmTxFeeInfo, handler);
    };
  }, [handler]);

  return null;
}

export const VerifyTxContainer = memo(BasicVerifyTxContainer);
