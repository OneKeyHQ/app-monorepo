import { useCallback } from 'react';

import { isEmpty } from 'lodash';

import type { PublicBackupData } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { ValidationFields } from '../../../../../components/Protected';
import useLocalAuthenticationModal from '../../../../../hooks/useLocalAuthenticationModal';

function isEmptyData(data: PublicBackupData) {
  let empty = true;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    data?: { privateData: string; publicData: string };
  }> = useCallback(
    async () =>
      new Promise((resolve) => {
        serviceCloudBackup.getDataForBackup('').then((data) => {
          if (isEmptyData(JSON.parse(data.publicData))) {
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
