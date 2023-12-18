import { Suspense, useCallback, useEffect } from 'react';

import { isNil } from 'lodash';

import { Dialog, Spinner } from '@onekeyhq/components';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword/types';
import {
  usePasswordAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import PasswordSetupContainer from './PasswordSetupContainer';
import PasswordVerifyContainer from './PasswordVerifyContainer';

const PasswordVerifyPromptMount = () => {
  const [{ passwordPromptPromiseId }] = usePasswordAtom();
  const [{ isPasswordSet }] = usePasswordPersistAtom();
  const onClose = useCallback((id: number) => {
    void backgroundApiProxy.servicePassword.resolvePasswordPromptDialog(id, {
      status: EPasswordResStatus.CLOSE_STATUS,
      password: '',
    });
  }, []);

  const showPasswordSetupPrompt = useCallback(
    (id: number) => {
      const dialog = Dialog.show({
        title: 'SetupPassword',
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
                    status: EPasswordResStatus.PASS_STATUS,
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
                    status: EPasswordResStatus.PASS_STATUS,
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
    if (!isNil(passwordPromptPromiseId)) {
      if (isPasswordSet) {
        showPasswordVerifyPrompt(passwordPromptPromiseId);
      } else {
        showPasswordSetupPrompt(passwordPromptPromiseId);
      }
    }
  }, [
    isPasswordSet,
    passwordPromptPromiseId,
    showPasswordSetupPrompt,
    showPasswordVerifyPrompt,
  ]);
  return null;
};

export default PasswordVerifyPromptMount;
