import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Input, Portal, Toast } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { SettingTestIDs } from '../testIDs';

export { useLanguageSelector } from './useLanguageSelector';
export { useLocaleOptions } from './useLocaleOptions';

// Dialog props shared by every dialog opened on top of the app-state lock
// screen (reset, biometric-changed warning, log upload): the lock container
// gives them the `lock` overlay level, so they render above the lock screen
// (OK-62416).
export const inAppStateLockDialogProps: Required<
  Pick<IDialogShowProps, 'portalContainer'>
> = {
  portalContainer: Portal.Constant.APP_STATE_LOCK_CONTAINER_OVERLAY,
};
export function useResetApp(
  params: {
    inAppStateLock?: boolean;
    silentReset?: boolean;
  } = {},
) {
  const { inAppStateLock = false, silentReset = false } = params || {};
  const intl = useIntl();

  const doReset = useCallback(async () => {
    // Fence queued UI snapshots before the background reset reaches this runtime.
    resetUtils.suspendSnapshotWrites();
    await backgroundApiProxy.serviceApp.resetApp({
      preserveBackupRecovery: !silentReset,
    });
  }, [silentReset]);

  return useCallback(async () => {
    await timerUtils.wait(50);

    if (silentReset) {
      try {
        await doReset();
        return true;
      } catch {
        // The background proxy displays the error. Let password verification
        // leave VERIFYING and retry instead of aborting its error handler.
        return false;
      }
    }

    if (inAppStateLock) {
      const isLock = await backgroundApiProxy.serviceApp.isAppLocked();
      if (!isLock) {
        return;
      }
    }
    Dialog.show({
      ...(inAppStateLock ? inAppStateLockDialogProps : undefined),
      title: intl.formatMessage({ id: ETranslations.global_reset }),
      icon: 'ErrorOutline',
      tone: 'destructive',
      description: intl.formatMessage({ id: ETranslations.reset_app_desc }),
      renderContent: (
        <Dialog.Form
          formProps={{
            defaultValues: { text: '' },
          }}
        >
          <Dialog.FormField name="text">
            <Input
              autoFocus
              flex={1}
              testID={SettingTestIDs.eraseDataInput}
              placeholder="RESET"
            />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      confirmButtonProps: {
        disabledOn: ({ getForm }) => {
          const { getValues } = getForm() || {};
          if (getValues) {
            const { text } = getValues() as { text: string };
            return text.trim().toUpperCase() !== 'RESET';
          }
          return true;
        },
        testID: SettingTestIDs.eraseDataConfirm,
      },
      onConfirm: async ({ preventClose }) => {
        defaultLogger.setting.page.resetApp({
          reason: 'ManualResetFromSettings',
        });
        try {
          await doReset();
        } catch (error) {
          preventClose();
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
            message: error instanceof Error ? error.message : undefined,
          });
        }
      },
    });
  }, [doReset, inAppStateLock, intl, silentReset]);
}
