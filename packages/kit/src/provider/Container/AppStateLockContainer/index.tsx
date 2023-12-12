import type { PropsWithChildren } from 'react';
import { Suspense, useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import {
  usePasswordAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import PasswordVerifyContainer from '../../../components/Password/container/PasswordVerifyContainer';

import AppStateLock from './components/AppStateLock';

export function AppStateLockContainer({
  children,
}: PropsWithChildren<unknown>) {
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
        const res =
          await backgroundApiProxy.servicePassword.getWebAuthPassword();
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
}
