import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';
import semver from 'semver';

import { Dialog, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppUpdateInfo } from '../components/UpdateReminder/hooks';

export const useVersionCompatible = () => {
  const intl = useIntl();
  const appUpdateInfo = useAppUpdateInfo();

  const showFallbackUpdateDialog = useCallback(
    (version: string | null | undefined) => {
      Dialog.show({
        icon: 'InfoCircleOutline',
        title: 'Update to continue',
        description: (
          <SizableText size="$bodyLg">
            The feature you tapped on requires version
            <SizableText size="$bodyLg" fontWeight="bold">
              {version ? `v${version}` : 'Latest Version'}
            </SizableText>
            or higher. Please update your app to continue.
          </SizableText>
        ),
        onConfirmText: 'Update',
        onConfirm: () => {
          appUpdateInfo.toUpdatePreviewPage();
        },
        onCancelText: intl.formatMessage({
          id: ETranslations.global_cancel,
        }),
      });
    },
    [appUpdateInfo, intl],
  );

  const isVersionCompatible = useCallback(
    (version: string | null | undefined) => {
      if (!version) {
        return true;
      }
      if (semver.gte(platformEnv.version ?? '0.0.0', version)) {
        return true;
      }

      setTimeout(() => {
        showFallbackUpdateDialog(version);
      }, 100);
      return false;
    },
    [showFallbackUpdateDialog],
  );

  return useMemo(
    () => ({ isVersionCompatible, showFallbackUpdateDialog }),
    [isVersionCompatible, showFallbackUpdateDialog],
  );
};
