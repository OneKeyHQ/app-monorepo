import { AppState } from 'react-native';

import { Dialog, Input, rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import type { IntlShape } from 'react-intl';

let manualBackupPending = false;

// This branch consumes no global password trigger or Jotai broadcast. The
// backend authorizes one expiring, wallet-bound request after password verification.
export async function getManualBackupMnemonic(
  walletId: string,
  intl: IntlShape,
) {
  if (manualBackupPending) return undefined;
  manualBackupPending = true;
  let cancelled = false;
  let sessionId: string | undefined;
  let dialog: ReturnType<typeof Dialog.show> | undefined;
  let finish: ((result: { mnemonic: string } | undefined) => void) | undefined;
  let settled = false;
  let submitting = false;
  let cancelInfo: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (settled) return;
    cancelled = true;
    settled = true;
    cancelInfo?.();
    finish?.(undefined);
    void dialog?.close();
    if (sessionId)
      void backgroundApiProxy.serviceAccount.cancelManualMnemonicRecovery({
        sessionId,
      });
  };
  const appState = AppState.addEventListener('change', (state) => {
    if (state !== 'active') cancel();
  });
  appEventBus.on(EAppEventBusNames.LockApp, cancel);
  const route = rootNavigationRef.current?.getCurrentRoute()?.key;
  const unsubscribeRoute = rootNavigationRef.current?.addListener(
    'state',
    () => {
      if (rootNavigationRef.current?.getCurrentRoute()?.key !== route) cancel();
    },
  );
  try {
    const infoRequest = backgroundApiProxy.serviceAccount
      .getManualMnemonicRecoveryInfo({
        walletId,
      })
      .then((info) => {
        if (cancelled && info) {
          void backgroundApiProxy.serviceAccount.cancelManualMnemonicRecovery({
            sessionId: info.sessionId,
          });
        }
        return info;
      });
    const info = await new Promise<Awaited<typeof infoRequest>>(
      (resolve, reject) => {
        cancelInfo = () => resolve(undefined);
        timeout = setTimeout(() => {
          reject(new OneKeyLocalError('Manual backup storage check timed out'));
          cancel();
        }, 15_000);
        void infoRequest.then(resolve, reject);
      },
    );
    clearTimeout(timeout);
    cancelInfo = undefined;
    if (cancelled) return undefined;
    if (!info) {
      const result =
        await backgroundApiProxy.serviceAccount.getHDAccountMnemonic({
          walletId,
          reason: EReasonForNeedPassword.Security,
        });
      return cancelled ? undefined : result;
    }
    sessionId = info.sessionId;
    timeout = setTimeout(cancel, Math.max(0, info.expiresAt - Date.now()));
    return await new Promise<{ mnemonic: string } | undefined>((resolve) => {
      finish = resolve;
      dialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.enter_passcode,
        }),
        renderContent: (
          <Dialog.Form formProps={{ defaultValues: { password: '' } }}>
            <Dialog.FormField name="password" rules={{ required: true }}>
              <Input
                testID="manual-mnemonic-recovery-password"
                secureTextEntry
                autoComplete="off"
                autoCorrect={false}
              />
            </Dialog.FormField>
          </Dialog.Form>
        ),
        onClose: () => {
          dialog?.getForm()?.reset({ password: '' });
          if (!settled) cancel();
        },
        onConfirm: async ({ getForm, close, preventClose }) => {
          if (cancelled || submitting) {
            preventClose();
            return;
          }
          submitting = true;
          const form = getForm();
          try {
            if (!form || !(await form.trigger())) {
              preventClose();
              return;
            }
            const password =
              await backgroundApiProxy.servicePassword.encodeSensitiveText({
                text: form.getValues().password as string,
              });
            form.reset({ password: '' });
            if (cancelled) return;
            const result =
              await backgroundApiProxy.serviceAccount.getManualRecoveryMnemonic(
                { sessionId: info.sessionId, password },
              );
            if (cancelled) return;
            settled = true;
            resolve(result);
            await close();
          } finally {
            form?.reset({ password: '' });
            submitting = false;
          }
        },
      });
    });
  } finally {
    cancelled = true;
    clearTimeout(timeout);
    appState.remove();
    unsubscribeRoute?.();
    appEventBus.off(EAppEventBusNames.LockApp, cancel);
    if (sessionId)
      void backgroundApiProxy.serviceAccount.cancelManualMnemonicRecovery({
        sessionId,
      });
    manualBackupPending = false;
  }
}
