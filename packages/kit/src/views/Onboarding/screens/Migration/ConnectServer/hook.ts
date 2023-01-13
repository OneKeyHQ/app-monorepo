import { useCallback } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import type { MigrateData } from '@onekeyhq/engine/src/types/migrate';
import type { PublicBackupData } from '@onekeyhq/shared/src/services/ServiceCloudBackup/ServiceCloudBackup.types';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { ValidationFields } from '../../../../../components/Protected';
import useLocalAuthenticationModal from '../../../../../hooks/useLocalAuthenticationModal';
import { deviceInfo } from '../util';

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
      if (isEmptyData(JSON.parse(data.public))) {
        return { status: ExportResult.EMPTY };
      }
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
      }),
    [exportDataPasswordDone, showVerify],
  );

  return { exportDataRequest };
}

export function useConnectServer() {
  const { serviceMigrate } = backgroundApiProxy;
  const intl = useIntl();

  const connectServer = useCallback(
    async (serverAddress: string) => {
      const serverInfo = await serviceMigrate.connectServer(serverAddress);
      if (serverInfo) {
        showMigrateDataModal({
          serverInfo,
          serverAddress,
          clientInfo: deviceInfo(),
        });
      } else {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'msg__invalid_link_or_network_error',
            }),
          },
          { type: 'error' },
        );
      }
    },
    [intl, serviceMigrate],
  );

  return { connectServer };
}
