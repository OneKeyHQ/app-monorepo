import { memo, useCallback, useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { showWalletBackupDialog } from './WalletBackupDialog';

function BasicWalletBackupPreCheckContainer() {
  const handler = useCallback(
    async ({
      promiseId,
      walletId,
    }: {
      promiseId: number;
      walletId: string;
    }) => {
      if (walletId && accountUtils.isHdWallet({ walletId })) {
        const wallet = await backgroundApiProxy.serviceAccount.getWallet({
          walletId,
        });
        if (wallet?.backuped) {
          await backgroundApiProxy.servicePromise.resolveCallback({
            id: promiseId,
            data: true,
          });
        } else {
          showWalletBackupDialog({
            wallet,
          });
          await backgroundApiProxy.servicePromise.rejectCallback({
            id: promiseId,
            error: undefined,
          });
        }
      } else {
        await backgroundApiProxy.servicePromise.resolveCallback({
          id: promiseId,
          data: true,
        });
      }
    },
    [],
  );

  useEffect(() => {
    appEventBus.on(EAppEventBusNames.CheckWalletBackupStatus, handler);
    return () => {
      appEventBus.off(EAppEventBusNames.CheckWalletBackupStatus, handler);
    };
  }, [handler]);

  return null;
}

export const WalletBackupPreCheckContainer = memo(
  BasicWalletBackupPreCheckContainer,
);
