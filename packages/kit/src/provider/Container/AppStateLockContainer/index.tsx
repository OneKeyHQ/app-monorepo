import type { PropsWithChildren } from 'react';
import { Suspense, useCallback, useEffect, useRef } from 'react';

import { AnimatePresence, Spinner, YStack } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { IS_LOW_END_DEVICE } from '@onekeyhq/shared/src/performance/deviceMemory';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  isUnlockTransition,
  shouldDeferColdStartLockRender,
} from '@onekeyhq/shared/src/utils/coldStartLockDecision';

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

  // Track whether this process has ever been unlocked. On low-end native devices
  // we skip rendering the full app tree behind the lock screen ONLY for a
  // cold-start lock (never unlocked yet) — so the single background JS thread
  // is free to finish the 600k-iteration PBKDF2 `verifyPassword` before the OS
  // (iOS jetsam / Android low-memory killer) kills the process. Once unlocked,
  // we always render children again so an auto-lock-while-using never unmounts
  // the user's current screen.
  //
  // The latch only flips on a real locked->unlocked transition (not on any
  // `isLocked === false` render) so a transient/default `false` during early
  // state hydration (e.g. the first cold start after upgrade) cannot
  // permanently defeat the optimization on the riskiest boot.
  const hasUnlockedOnceRef = useRef(false);
  const prevLockedRef = useRef(isLocked);
  if (isUnlockTransition(prevLockedRef.current, isLocked)) {
    hasUnlockedOnceRef.current = true;
  }
  prevLockedRef.current = isLocked;
  // Gated to native: low-RAM iOS (jetsam) and low-RAM Android (low-memory
  // killer) both risk an OS process kill during the cold-start lock while the
  // single background JS thread runs the heavy PBKDF2 verifyPassword. Web/desktop
  // have no such cold-start memory-kill pressure, so they never defer — and the
  // build-time `isNative` constant lets the whole call dead-code-eliminate there.
  const deferColdStartChildren = platformEnv.isNative
    ? shouldDeferColdStartLockRender({
        isLowEndDevice: IS_LOW_END_DEVICE,
        isLocked,
        hasUnlockedOnce: hasUnlockedOnceRef.current,
      })
    : false;

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
      {deferColdStartChildren ? null : children}
      {!isLocked ? <AppStateUpdater /> : null}
      <AnimatePresence>
        {isLocked ? (
          <AppStateLock
            lockContainerRef={lockContainerRef as any}
            key="unlock-screen"
            animation="quick"
            animateOnly={ANIMATE_ONLY_OPACITY}
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
