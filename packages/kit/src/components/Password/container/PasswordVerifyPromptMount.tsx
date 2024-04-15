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

  const onRejectPasswordPromptVerifyDialog = useCallback(() => {
    console.log('onRejectPasswordPromptVerifyDialog');
    if (
      passwordPromptPromiseDataRef.current?.idNumber &&
      passwordPromptPromiseDataRef.current?.type ===
        EPasswordPromptType.PASSWORD_VERIFY
    ) {
      onClose(passwordPromptPromiseDataRef.current.idNumber);
    }
  }, [onClose]);

  const showPasswordSetupPrompt = useCallback(
    (id: number) => {
      const dialog = Dialog.show({
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
                void dialog.close();
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
      const dialog = Dialog.show({
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
                void dialog.close();
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
    }
  }, [
    passwordPromptPromiseTriggerData,
    showPasswordSetupPrompt,
    showPasswordVerifyPrompt,
  ]);

  useEffect(() => {
    const isExt = platformEnv.isExtension;
    console.log('registerWindowUnload---', isExt);
    if (isExt) {
      window.addEventListener(
        'beforeunload',
        onRejectPasswordPromptVerifyDialog,
      );
    }
    return () => {
      if (isExt) {
        window.removeEventListener(
          'beforeunload',
          onRejectPasswordPromptVerifyDialog,
        );
      }
    };
  }, [onRejectPasswordPromptVerifyDialog]);

  return null;
};

export default PasswordVerifyPromptMount;
