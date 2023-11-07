import { Suspense, useCallback, useEffect } from 'react';

import { Dialog, Spinner } from '@onekeyhq/components';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword';
import { useSettingsPromptPromiseAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import PasswordVerifyContainer from './PasswordVerifyContainer';

const PasswordVerifyPromptMount = () => {
  const [{ promiseId }] = useSettingsPromptPromiseAtom();
  const showPasswordVerifyPrompt = useCallback((id: number) => {
    const dialog = Dialog.confirm({
      title: 'ConfirmPassword',
      renderContent: (
        <Suspense fallback={<Spinner size="large" />}>
          <PasswordVerifyContainer
            onVerifyRes={(data) => {
              console.log('verify data', data);
              if (data) {
                backgroundApiProxy.servicePromise.resolveCallback({
                  id,
                  data: {
                    status: EPasswordResStatus.PASS_STATUS,
                    data: { password: data },
                  },
                });
                dialog.close();
              } else {
                backgroundApiProxy.servicePromise.rejectCallback({
                  id,
                  error: { message: '密码验证失败' },
                });
              }
            }}
          />
        </Suspense>
      ),
      showFooter: false,
    });
  }, []);
  useEffect(() => {
    if (promiseId) {
      showPasswordVerifyPrompt(promiseId);
    }
  }, [promiseId, showPasswordVerifyPrompt]);
  return null;
};

export default PasswordVerifyPromptMount;
