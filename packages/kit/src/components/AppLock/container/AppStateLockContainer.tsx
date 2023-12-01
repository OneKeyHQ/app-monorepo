import type { FC, PropsWithChildren } from 'react';
import { Suspense, useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import {
  usePasswordAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import PasswordVerifyContainer from '../../Password/container/PasswordVerifyContainer';
import AppStateLock from '../components/AppStateLock';

const AppStateLockContainer: FC<PropsWithChildren> = ({ children }) => {
  const [{ unLock }] = usePasswordAtom();
  const [{ isPasswordSet, webAuthCredentialId }] = usePasswordPersistAtom();
  const handleUnlock = useCallback(async () => {
    await backgroundApiProxy.servicePassword.unLockApp();
  }, []);

  if (unLock || !isPasswordSet) {
    return children;
  }

  return (
    <AppStateLock
      enableWebAuth={!!webAuthCredentialId}
      onWebAuthVerify={async () => {
        const res = await backgroundApiProxy.servicePassword.verifyWebAuth();
        if (res) {
          await handleUnlock();
        } else {
          Toast.error({ title: '请输入密码' });
        }
      }}
      passwordVerifyContainer={
        <Suspense>
          <PasswordVerifyContainer
            onVerifyRes={async (data) => {
              if (data) {
                await handleUnlock();
              }
            }}
          />
        </Suspense>
      }
    />
  );
};

export default AppStateLockContainer;
