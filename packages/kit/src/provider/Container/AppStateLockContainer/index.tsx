import type { PropsWithChildren } from 'react';
import { Suspense, useCallback, useEffect, useRef } from 'react';

import { AnimatePresence, Spinner, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PasswordVerifyContainer from '../../../components/Password/container/PasswordVerifyContainer';

import AppStateLock from './components/AppStateLock';
import { AppStateUpdater } from './components/AppStateUpdater';

const isLockContainerTampered = (el: HTMLElement): boolean => {
  const style = globalThis.getComputedStyle(el);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    parseFloat(style.opacity) < 0.1 ||
    style.pointerEvents === 'none' ||
    el.offsetWidth === 0 ||
    el.offsetHeight === 0
  ) {
    return true;
  }
  return false;
};

const useWebLockCheck = (isLocked: boolean) => {
  const lockContainerRef = useRef<HTMLElement | null>(null);
  const lockedRef = useRef(isLocked);
  if (lockedRef.current !== isLocked) {
    lockedRef.current = isLocked;
  }
  const checkIsLockContainerExist = useCallback(() => {
    if (!lockedRef.current) {
      return;
    }
    if (
      !lockContainerRef.current ||
      !document.body.contains(lockContainerRef.current) ||
      isLockContainerTampered(lockContainerRef.current)
    ) {
      if (!lockContainerRef.current) {
        // ref not yet assigned, keep polling until mounted
        setTimeout(checkIsLockContainerExist, 300);
        return;
      }
      globalThis.location.reload();
      return;
    }
    setTimeout(checkIsLockContainerExist, 300);
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
