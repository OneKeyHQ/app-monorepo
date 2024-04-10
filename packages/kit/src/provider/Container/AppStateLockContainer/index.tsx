import type { PropsWithChildren } from 'react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { AnimatePresence } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PasswordVerifyContainer from '../../../components/Password/container/PasswordVerifyContainer';

import AppStateLock from './components/AppStateLock';
import { AppStateUpdater } from './components/AppStateUpdater';

import type { LayoutChangeEvent } from 'react-native';

const useWebLockCheck = (isLocked: boolean) => {
  const lockContainerRef = useRef<HTMLElement | null>();
  const lockedRef = useRef(isLocked);
  if (lockedRef.current !== isLocked) {
    lockedRef.current = isLocked;
  }
  const checkIsLockContainerExist = useCallback(() => {
    if (lockContainerRef?.current && lockedRef.current) {
      if (!document.body.contains(lockContainerRef.current)) {
        window.location.reload();
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
  // Pre-rendering on the web platform not only does not improve the rendering speed of the lock screen interface,
  // but also causes the input box to be unable to auto focus.
  const [isPreloadChildren, setIsPreloadChildren] = useState(
    // only works on native.
    platformEnv.isRuntimeBrowser,
  );
  const showChildren = useCallback(() => {
    setTimeout(() => {
      setIsPreloadChildren(true);
    }, 50);
  }, []);
  const handleUnlock = useCallback(async () => {
    await backgroundApiProxy.servicePassword.unLockApp();
  }, []);
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height } = e.nativeEvent.layout;
      if (height) {
        showChildren();
      }
    },
    [showChildren],
  );

  const lockContainerRef = useWebLockCheck(isLocked);

  const isShowChildren = !isLocked || isPreloadChildren;
  return (
    <>
      {isShowChildren ? children : null}
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
              <Suspense>
                <PasswordVerifyContainer
                  onLayout={handleLayout}
                  onVerifyRes={async (data) => {
                    if (data) {
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
