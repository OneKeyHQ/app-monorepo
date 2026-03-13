import type { PropsWithChildren } from 'react';
import { Suspense, useCallback, useEffect, useRef } from 'react';

import { AnimatePresence, Spinner, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PasswordVerifyContainer from '../../../components/Password/container/PasswordVerifyContainer';

import AppStateLock from './components/AppStateLock';
import { AppStateUpdater } from './components/AppStateUpdater';

const isLockContainerTampered = (
  el: HTMLElement,
  lockedRef: React.MutableRefObject<boolean>,
): boolean => {
  // Skip tamper check when unlocking to avoid false positives
  // during AnimatePresence exit animation (opacity transitions to 0)
  if (!lockedRef.current) {
    return false;
  }
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

// Max retries before force reload when lock container ref is not assigned (~6s)
const MAX_NULL_REF_RETRIES = 20;

const useWebLockCheck = (isLocked: boolean) => {
  const lockContainerRef = useRef<HTMLElement | null>(null);
  const lockedRef = useRef(isLocked);
  const nullRefRetryCountRef = useRef(0);
  if (lockedRef.current !== isLocked) {
    lockedRef.current = isLocked;
  }
  const checkIsLockContainerExist = useCallback(() => {
    if (!lockedRef.current) {
      nullRefRetryCountRef.current = 0;
      return;
    }
    if (
      !lockContainerRef.current ||
      !document.body.contains(lockContainerRef.current) ||
      isLockContainerTampered(lockContainerRef.current, lockedRef)
    ) {
      if (!lockContainerRef.current) {
        nullRefRetryCountRef.current += 1;
        if (nullRefRetryCountRef.current > MAX_NULL_REF_RETRIES) {
          globalThis.location.reload();
          return;
        }
        // ref not yet assigned, keep polling until mounted
        setTimeout(checkIsLockContainerExist, 300);
        return;
      }
      globalThis.location.reload();
      return;
    }
    nullRefRetryCountRef.current = 0;
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

  // When locked, set `inert` on all document.body children that don't contain
  // the lock screen. This disables focus traps (FocusScope) in portaled Dialogs
  // at the browser level, allowing the lock screen input to receive focus.
  useEffect(() => {
    if (platformEnv.isNative || !isLocked) return;

    const lockEl = lockContainerRef.current;
    if (!lockEl) return;

    const inertElements: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child instanceof HTMLElement && !child.contains(lockEl)) {
        child.inert = true;
        inertElements.push(child);
      }
    }

    return () => {
      for (const el of inertElements) {
        el.inert = false;
      }
    };
  }, [isLocked, lockContainerRef]);

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
