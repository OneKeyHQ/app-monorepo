import type { PropsWithChildren } from 'react';
import { useEffect, useRef, useState } from 'react';

import { useToasterStore } from '@backpackapp-io/react-native-toast';

import { OverlayContainer } from '@onekeyhq/components';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function ToastOverlayContainer({
  children,
  bringToFrontToken = 0,
}: PropsWithChildren<{ bringToFrontToken?: number }>) {
  const { toasts } = useToasterStore();
  const [isLocked] = useAppIsLockedAtom();
  const previousToastsRef = useRef(new Map<string, number>());
  const [toastRaiseToken, setToastRaiseToken] = useState(0);

  useEffect(() => {
    const visibleToasts = new Map(
      toasts
        .filter((toast) => toast.visible)
        .map((toast) => [toast.id, toast.createdAt]),
    );
    const hasNewToast = [...visibleToasts].some(
      ([id, createdAt]) => previousToastsRef.current.get(id) !== createdAt,
    );
    // Consume locked notifications too, so unlocking cannot raise stale toasts.
    previousToastsRef.current = visibleToasts;
    if (platformEnv.isNativeIOS && !isLocked && hasNewToast) {
      // Native window ordering cannot be changed with a React Native z-index.
      setToastRaiseToken((token) => token + 1);
    }
  }, [isLocked, toasts]);

  return (
    <OverlayContainer bringToFrontToken={bringToFrontToken + toastRaiseToken}>
      {children}
    </OverlayContainer>
  );
}
