import { Suspense, useCallback, useEffect } from 'react';

import { isNil } from 'lodash';

import { Dialog, Spinner } from '@onekeyhq/components';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword/types';
import { usePasswordAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';


import PasswordSetupContainer from './PasswordSetupContainer';
import PasswordVerifyContainer from './PasswordVerifyContainer';

const PasswordVerifyPromptMount = () => {
  const [{ passwordPromptPromiseTriggerData }] = usePasswordAtom();
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
    if (
      passwordPromptPromiseTriggerData &&
      !isNil(passwordPromptPromiseTriggerData.idNumber)
    ) {
      if (passwordPromptPromiseTriggerData.type === 'verify') {
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
  return null;
};

export default PasswordVerifyPromptMount;
