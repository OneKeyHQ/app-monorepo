import { useCallback } from 'react';

import { isEmpty } from 'lodash';

import type { MigrateData } from '@onekeyhq/engine/src/types/migrate';
import type { PublicBackupData } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { ValidationFields } from '../../../../../components/Protected';
import useLocalAuthenticationModal from '../../../../../hooks/useLocalAuthenticationModal';

import { showMigrateDataModal } from './MigrateDataModal';

function isEmptyData(data: PublicBackupData) {
  let empty = true;
  Object.entries(data).forEach(([_, value]) => {
    if (!isEmpty(value)) {
      empty = false;
    }
  });
  return empty;
}

export enum ExportResult {
  SUCCESS = 'success',
  EMPTY = 'empty',
  CANCEL = 'cancel',
}

export function useExportData() {
  const { showVerify } = useLocalAuthenticationModal();
  const { serviceCloudBackup } = backgroundApiProxy;
  const exportDataPasswordDone = useCallback(
    async (password: string) => {
      const data = await serviceCloudBackup.getDataForBackup(password);
      return { status: ExportResult.SUCCESS, data };
    },
    [serviceCloudBackup],
  );

  const exportDataRequest: () => Promise<{
    status: ExportResult;
    data?: MigrateData;
  }> = useCallback(
    async () =>
      new Promise((resolve) => {
        serviceCloudBackup.getDataForBackup('').then((data) => {
          if (isEmptyData(JSON.parse(data.public))) {
            resolve({ status: ExportResult.EMPTY });
          } else {
            showVerify(
              (password) => {
                exportDataPasswordDone(password).then((result) => {
                  resolve(result);
                });
              },
              () => {
                resolve({ status: ExportResult.CANCEL });
              },
              null,
              ValidationFields.Secret,
            );
          }
        });
      }),
    [exportDataPasswordDone, serviceCloudBackup, showVerify],
  );

  return { exportDataRequest };
}

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
