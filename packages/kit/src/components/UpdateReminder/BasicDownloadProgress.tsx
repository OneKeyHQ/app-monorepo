import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useDownloadProgress } from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

export function DownloadProgress() {
  const intl = useIntl();
  const onSuccess = useCallback(() => {
    void backgroundApiProxy.serviceAppUpdate.readyToInstall();
  }, []);
  const onFailed = useCallback((e: { message: string }) => {
    void backgroundApiProxy.serviceAppUpdate.notifyFailed(e);
  }, []);
  const percent = useDownloadProgress(onSuccess, onFailed);
  return intl.formatMessage(
    { id: ETranslations.update_downloading_package },
    { progress: percent },
  );
}
