import { Suspense, useCallback, useEffect } from 'react';

import { isNil } from 'lodash';

import { Dialog, Spinner } from '@onekeyhq/components';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword/types';
import { usePasswordAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import PasswordVerifyContainer from './PasswordVerifyContainer';

const PasswordVerifyPromptMount = () => {
  const [{ passwordPromptPromiseId }] = usePasswordAtom();
  const showPasswordVerifyPrompt = useCallback((id: number) => {
    const dialog = Dialog.show({
      title: 'ConfirmPassword',
      onClose() {
        void backgroundApiProxy.servicePassword.rejectPasswordPromptDialog(id, {
          message: '',
        });
      },
      renderContent: (
        <Suspense fallback={<Spinner size="large" />}>
          <PasswordVerifyContainer
            onVerifyRes={async (data) => {
              console.log('verify data', data);
              if (data) {
                await backgroundApiProxy.servicePassword.resolvePasswordPromptDialog(
                  id,
                  {
                    status: EPasswordResStatus.PASS_STATUS,
                    data: { password: data },
                  },
                );
                dialog.close();
              }
            }}
          />
        </Suspense>
      ),
      showFooter: false,
    });
  }, []);
  useEffect(() => {
    if (!isNil(passwordPromptPromiseId)) {
      showPasswordVerifyPrompt(passwordPromptPromiseId);
    }
  }, [passwordPromptPromiseId, showPasswordVerifyPrompt]);
  return null;
};

export default PasswordVerifyPromptMount;
