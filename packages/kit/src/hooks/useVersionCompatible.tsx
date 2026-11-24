import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import semver from 'semver';

import { Dialog } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppUpdateInfo } from '../components/AppUpdate';
import { isForceUpdateUiActive } from '../views/AppUpdate/hooks/useForceUpdateContactSupport';

export function isVersionCompatible(version: string | null | undefined) {
  return !version || semver.gte(platformEnv.version ?? '0.0.0', version);
}

export const useVersionCompatible = () => {
  const intl = useIntl();
  const appUpdateInfo = useAppUpdateInfo();

  const showFallbackUpdateDialog = useCallback(
    (version: string | null | undefined) => {
      if (isForceUpdateUiActive()) return;
      Dialog.show({
        icon: 'InfoCircleOutline',
        title: intl.formatMessage({
          id: ETranslations.global_update_to_continue_title,
        }),
        description: intl.formatMessage(
          {
            id: version
              ? ETranslations.global_update_to_continue_desc
              : ETranslations.global_update_to_continue_desc_fallback,
          },
          {
            version,
          },
        ),
        onConfirmText: intl.formatMessage({
          id: ETranslations.update_update_now,
        }),
        onConfirm: () => {
          appUpdateInfo.toUpdatePreviewPage(
            false,
            undefined,
            () => !isForceUpdateUiActive(),
          );
        },
        onCancelText: intl.formatMessage({
          id: ETranslations.global_cancel,
        }),
      });
    },
    [appUpdateInfo, intl],
  );

  return useMemo(
    () => ({ showFallbackUpdateDialog }),
    [showFallbackUpdateDialog],
  );
};
