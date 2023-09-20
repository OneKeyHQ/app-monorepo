import { useCallback } from 'react';

import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { showDialog } from '../../../../../utils/overlayUtils';

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
              showDialog(<PermissionDialog type="localNetwork" />);
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
