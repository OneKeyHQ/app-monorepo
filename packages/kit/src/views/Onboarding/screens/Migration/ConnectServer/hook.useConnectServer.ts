import { useCallback } from 'react';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';

import { showMigrateDataModal } from './MigrateDataModal';

export function useConnectServer() {
  const { serviceMigrate } = backgroundApiProxy;

  const connectServer = useCallback(
    async (serverAddress: string) => {
      const serverInfo = await serviceMigrate.connectServer(serverAddress);

      if (serverInfo) {
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
