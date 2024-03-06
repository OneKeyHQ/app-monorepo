import type { PropsWithChildren } from 'react';
import { Suspense, useCallback, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import { Stack, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useAppIsLockedAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useWebAuthActions } from '../../../components/BiologyAuthComponent/hooks/useWebAuthActions';
import PasswordVerifyContainer from '../../../components/Password/container/PasswordVerifyContainer';

import AppStateLock from './components/AppStateLock';
import { AppStateUpdater } from './components/AppStateUpdater';

import type { LayoutChangeEvent } from 'react-native';

export function AppStateLockContainer({
  children,
}: PropsWithChildren<unknown>) {
  const [isLocked] = useAppIsLockedAtom();
  const { verifiedPasswordWebAuth } = useWebAuthActions();
  const [{ webAuthCredentialId }] = usePasswordPersistAtom();
  const [isPreloadChildren, setIsPreloadChildren] = useState(false);
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

  const isShowChildren = !isLocked || isPreloadChildren;
  return (
    <>
      {isShowChildren ? children : null}
      {!isLocked && <AppStateUpdater />}
      <AnimatePresence>
        {isLocked && (
          <Stack
            key="unlock-screen"
            animation="quick"
            enterStyle={{
              opacity: 1,
            }}
            exitStyle={{
              opacity: 0,
            }}
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
          >
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
          </Stack>
        )}
      </AnimatePresence>
    </>
  );
}
