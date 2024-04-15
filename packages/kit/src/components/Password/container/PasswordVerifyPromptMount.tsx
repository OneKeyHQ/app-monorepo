import { Suspense, useCallback, useEffect, useRef } from 'react';

import { isNil } from 'lodash';

import { Dialog, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EPasswordPromptType } from '@onekeyhq/kit-bg/src/services/ServicePassword/types';
import { usePasswordPromptPromiseTriggerAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PasswordSetupContainer from './PasswordSetupContainer';
import PasswordVerifyContainer from './PasswordVerifyContainer';

const PasswordVerifyPromptMount = () => {
  const [{ passwordPromptPromiseTriggerData }] =
    usePasswordPromptPromiseTriggerAtom();
  const onClose = useCallback((id: number) => {
    void backgroundApiProxy.servicePassword.rejectPasswordPromptDialog(id, {
      message: 'User Cancelled Password Verify',
    });
  }, []);

  const passwordPromptPromiseDataRef = useRef(passwordPromptPromiseTriggerData);
  if (
    passwordPromptPromiseDataRef.current !== passwordPromptPromiseTriggerData
  ) {
    passwordPromptPromiseDataRef.current = passwordPromptPromiseTriggerData;
  }

  const dialogRef = useRef<ReturnType<typeof Dialog.show> | null>(null);

  const onRejectPasswordPromptVerifyDialog = useCallback(() => {
    if (passwordPromptPromiseDataRef.current?.idNumber) {
      onClose(passwordPromptPromiseDataRef.current.idNumber);
    }
    void chrome.runtime.sendMessage({ message: 'popupClosed' });
  }, [onClose]);

  const showPasswordSetupPrompt = useCallback(
    (id: number) => {
      dialogRef.current = Dialog.show({
        title: 'Setup Password',
        onClose() {
          onClose(id);
        },
        renderContent: (
          <Suspense fallback={<Spinner size="large" />}>
            <PasswordSetupContainer
              onSetupRes={async (data) => {
                await backgroundApiProxy.servicePassword.resolvePasswordPromptDialog(
                  id,
                  {
                    password: data,
                  },
                );
              }}
            />
          </Suspense>
        ),
        showFooter: false,
      });
    },
    [onClose],
  );
  const showPasswordVerifyPrompt = useCallback(
    (id: number) => {
      dialogRef.current = Dialog.show({
        title: 'ConfirmPassword',
        onClose() {
          onClose(id);
        },
        renderContent: (
          <Suspense fallback={<Spinner size="large" />}>
            <PasswordVerifyContainer
              onVerifyRes={async (data) => {
                await backgroundApiProxy.servicePassword.resolvePasswordPromptDialog(
                  id,
                  {
                    password: data,
                  },
                );
              }}
            />
          </Suspense>
        ),
        showFooter: false,
      });
    },
    [onClose],
  );
  useEffect(() => {
    if (
      passwordPromptPromiseTriggerData &&
      !isNil(passwordPromptPromiseTriggerData.idNumber)
    ) {
      if (
        passwordPromptPromiseTriggerData.type ===
        EPasswordPromptType.PASSWORD_VERIFY
      ) {
        showPasswordVerifyPrompt(passwordPromptPromiseTriggerData.idNumber);
      } else {
        showPasswordSetupPrompt(passwordPromptPromiseTriggerData.idNumber);
      }
    } else {
      void dialogRef.current?.close();
    }
  }, [
    passwordPromptPromiseTriggerData,
    showPasswordSetupPrompt,
    showPasswordVerifyPrompt,
  ]);

  useEffect(() => {
    const isExtensionUi = platformEnv.isExtensionUi;
    if (isExtensionUi) {
      window.addEventListener('unload', onRejectPasswordPromptVerifyDialog);
    }
    return () => {
      if (isExtensionUi) {
        window.removeEventListener(
          'unload',
          onRejectPasswordPromptVerifyDialog,
        );
      }
    };
  }, [onRejectPasswordPromptVerifyDialog]);

  return null;
};

export default PasswordVerifyPromptMount;
