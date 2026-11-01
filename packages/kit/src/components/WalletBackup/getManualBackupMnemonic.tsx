import { AppState } from 'react-native';

import { Dialog, Input, Toast, rootNavigationRef } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
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
  let completing = false;
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
  let listenersAttached = true;
  const removeRecoveryListeners = () => {
    if (!listenersAttached) return;
    listenersAttached = false;
    appState.remove();
    unsubscribeRoute?.();
    appEventBus.off(EAppEventBusNames.LockApp, cancel);
  };
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
      // The established password flow owns its lifecycle, including native
      // authentication overlays. Recovery cancellation must not discard it.
      removeRecoveryListeners();
      const result =
        await backgroundApiProxy.serviceAccount.getHDAccountMnemonic({
          walletId,
          reason: EReasonForNeedPassword.Security,
        });
      return result;
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
          if (!settled && !completing) cancel();
        },
        onConfirm: async ({ getForm, close, preventClose }) => {
          if (cancelled || submitting) {
            preventClose();
            return;
          }
          submitting = true;
          const form = getForm();
          let passwordError: string | undefined;
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
            completing = true;
            await close();
            if (cancelled) return;
            settled = true;
            resolve(result);
          } catch (error) {
            preventClose();
            if (cancelled) return;
            const className =
              error && typeof error === 'object' && 'className' in error
                ? error.className
                : undefined;
            if (
              className === EOneKeyErrorClassNames.WrongPassword &&
              !completing
            ) {
              passwordError = intl.formatMessage({
                id: ETranslations.auth_error_password_incorrect,
              });
            } else {
              if (!errorToastUtils.wasAutoToastShown(error))
                Toast.error({
                  title:
                    error instanceof Error
                      ? error.message
                      : intl.formatMessage({
                          id: ETranslations.global_unknown_error,
                        }),
                });
              if (completing) cancel();
            }
          } finally {
            form?.reset({ password: '' });
            if (passwordError && !cancelled)
              form?.setError('password', {
                type: 'manual',
                message: passwordError,
              });
            submitting = false;
            completing = false;
          }
        },
      });
    });
  } finally {
    cancelled = true;
    clearTimeout(timeout);
    removeRecoveryListeners();
    if (sessionId)
      void backgroundApiProxy.serviceAccount.cancelManualMnemonicRecovery({
        sessionId,
      });
    manualBackupPending = false;
  }
}
