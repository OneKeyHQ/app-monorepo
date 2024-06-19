import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useDownloadProgress } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export function DownloadProgress() {
  const intl = useIntl();
  const onSuccess = useCallback(() => {
    void backgroundApiProxy.serviceAppUpdate.readyToInstall();
  }, []);
  const onFailed = useCallback(
    (e: { message: string }) => {
      Toast.error({
        title: intl.formatMessage({ id: ETranslations.global_update_failed }),
      });
      void backgroundApiProxy.serviceAppUpdate.notifyFailed(e);
    },
    [intl],
  );
  const percent = useDownloadProgress(onSuccess, onFailed);
  return intl.formatMessage(
    { id: ETranslations.update_downloading_package },
    { progress: percent },
  );
}
