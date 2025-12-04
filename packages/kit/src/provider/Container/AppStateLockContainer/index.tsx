import type { PropsWithChildren } from 'react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { AnimatePresence, Spinner, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PasswordVerifyContainer from '../../../components/Password/container/PasswordVerifyContainer';

import AppStateLock from './components/AppStateLock';
import { AppStateUpdater } from './components/AppStateUpdater';

import type { LayoutChangeEvent } from 'react-native';

const useWebLockCheck = (isLocked: boolean) => {
  const lockContainerRef = useRef<HTMLElement | null>(null);
  const lockedRef = useRef(isLocked);
  if (lockedRef.current !== isLocked) {
    lockedRef.current = isLocked;
  }
  const checkIsLockContainerExist = useCallback(() => {
    if (lockContainerRef?.current && lockedRef.current) {
      if (!document.body.contains(lockContainerRef.current)) {
        globalThis.location.reload();
      }
      setTimeout(checkIsLockContainerExist, 300);
    }
  }, []);
  useEffect(() => {
    if (!platformEnv.isNative && isLocked) {
      setTimeout(() => {
        checkIsLockContainerExist();
      });
    }
  }, [checkIsLockContainerExist, isLocked]);
  return lockContainerRef;
};

export function AppStateLockContainer({
  children,
}: PropsWithChildren<unknown>) {
  const [isLocked] = useAppIsLockedAtom();

  const handleUnlock = useCallback(async () => {
    await backgroundApiProxy.servicePassword.unLockApp();
  }, []);

  const lockContainerRef = useWebLockCheck(isLocked);

  return (
    <>
      {children}
      {!isLocked ? <AppStateUpdater /> : null}
      <AnimatePresence>
        {isLocked ? (
          <AppStateLock
            lockContainerRef={lockContainerRef as any}
            key="unlock-screen"
            animation="quick"
            enterStyle={{
              opacity: 1,
            }}
            exitStyle={{
              opacity: 0,
            }}
            passwordVerifyContainer={
              <Suspense
                fallback={
                  <YStack h={46} justifyContent="center" alignItems="center">
                    <Spinner size="large" />
                  </YStack>
                }
              >
                <PasswordVerifyContainer
                  name="lock"
                  onVerifyRes={async (data) => {
                    // isExt support lock without password
                    if (data || platformEnv.isExtension) {
                      await handleUnlock();
                    }
                  }}
                />
              </Suspense>
            }
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}
