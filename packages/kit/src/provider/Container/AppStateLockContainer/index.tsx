import type { PropsWithChildren } from 'react';
import { Suspense, useCallback } from 'react';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useAppIsLockedAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useWebAuthActions } from '../../../components/BiologyAuthComponent/hooks/useWebAuthActions';
import PasswordVerifyContainer from '../../../components/Password/container/PasswordVerifyContainer';

import AppStateLock from './components/AppStateLock';
import { AppStateUpdater } from './components/AppStateUpdater';

export function AppStateLockContainer({
  children,
}: PropsWithChildren<unknown>) {
  const [isLocked] = useAppIsLockedAtom();
  const { verifiedPasswordWebAuth } = useWebAuthActions();
  const [{ webAuthCredentialId }] = usePasswordPersistAtom();
  const handleUnlock = useCallback(async () => {
    await backgroundApiProxy.servicePassword.unLockApp();
  }, []);
  if (!isLocked) {
    return (
      <>
        {children}
        <AppStateUpdater />
      </>
    );
  }

  return (
    <AppStateLock
      enableWebAuth={!!webAuthCredentialId}
      onWebAuthVerify={async () => {
        try {
          await verifiedPasswordWebAuth();
          await handleUnlock();
        } catch (e) {
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
