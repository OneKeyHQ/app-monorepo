import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Input, Portal } from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { RESET_OVERLAY_Z_INDEX } from '@onekeyhq/shared/src/utils/overlayUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { SettingTestIDs } from '../testIDs';

export { useLanguageSelector } from './useLanguageSelector';
export { useLocaleOptions } from './useLocaleOptions';

// Dialog props shared by every dialog opened on top of the app-state lock
// screen (reset, biometric-changed warning, log upload). They belong together
// because APP_STATE_LOCK_CONTAINER_OVERLAY is the only place such a dialog can
// render and stay both visible and interactive, and on every platform reaching
// it means opting out of a different escape hatch (OK-62416):
//
//   - `isOverTopAllViews` moves the dialog out of that container. On web it
//     re-portals to `document.body`, straight into the sweep that marks every
//     other body child `inert` so nothing can steal focus from the passcode
//     input (see AppStateLockContainer). On iOS it mounts the dialog into the
//     app's window overlay, which was added before the lock screen's own and
//     therefore sits under it. Both leave a dialog the user cannot use, so the
//     container — now hosted inside the lock screen's top layer on web, iOS and
//     Android alike — is always the right target.
//   - a sheet-form dialog (viewport below `$gtMd`: extension popup and side
//     panel, narrow desktop/web) escapes the same container on its own, because
//     Tamagui portals a `modal` sheet to `document.body`. `passThrough` opts
//     that portal out and keeps the sheet where it was mounted. Tamagui only
//     reads `portalProps` in its web modal branch, so this is inert on native.
export const inAppStateLockDialogProps: Required<
  Pick<
    IDialogShowProps,
    | 'sheetProps'
    | 'floatingPanelProps'
    | 'isOverTopAllViews'
    | 'portalContainer'
  >
> = {
  sheetProps: {
    zIndex: RESET_OVERLAY_Z_INDEX,
    portalProps: {
      passThrough: true,
    },
  },
  floatingPanelProps: {
    zIndex: RESET_OVERLAY_Z_INDEX,
  },
  isOverTopAllViews: false,
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
    // reset app
    try {
      // disable setInterval on ext popup
      if (platformEnv.isExtensionUiPopup) {
        resetUtils.startResetting();
      }
      await backgroundApiProxy.serviceApp.resetApp();
    } catch (e) {
      console.error('failed to reset app with error', e);
    } finally {
      // able setInterval on ext popup
      if (platformEnv.isExtensionUiPopup) {
        resetUtils.endResetting();
      }
    }
  }, []);

  return useCallback(async () => {
    await timerUtils.wait(50);

    if (silentReset) {
      await doReset();
      return;
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
      onConfirm: async () => {
        defaultLogger.setting.page.resetApp({
          reason: 'ManualResetFromSettings',
        });
        await doReset();
      },
    });
  }, [doReset, inAppStateLock, intl, silentReset]);
}
