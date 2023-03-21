import { useCallback } from 'react';

import DialogManager from '@onekeyhq/components/src/DialogManager';
import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';

import { showMigrateDataModal } from './MigrateDataModal';

export function useConnectServer() {
  const { serviceMigrate } = backgroundApiProxy;

  const connectServer = useCallback(
    async (serverAddress: string) => {
      const serverInfo = await serviceMigrate.connectServer(serverAddress);

      if (serverInfo) {
        if (typeof serverInfo === 'string') {
          if (serverInfo === 'ERR_NETWORK') {
            if (platformEnv.isNativeIOS) {
              DialogManager.show({
                render: <PermissionDialog type="localNetwork" />,
              });
            }
          }
          return false;
        }
        showMigrateDataModal({
          serverInfo,
          serverAddress,
        });
        return true;
      }
      return false;
    },
    [serviceMigrate],
  );

  return { connectServer };
}
