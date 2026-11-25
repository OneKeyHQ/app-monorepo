import { useSyncExternalStore } from 'react';

import { useRouteIsFocusedWhenEnabled } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useDeviceStageAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/hardware';

const subscribeVisibility = (listener: () => void) => {
  document.addEventListener('visibilitychange', listener);
  return () => document.removeEventListener('visibilitychange', listener);
};
const isVisible = () => document.visibilityState !== 'hidden';

export function useScanCameraIsActive(disableNavigationGuard?: boolean) {
  const [stage] = useDeviceStageAtom();
  const focused = useRouteIsFocusedWhenEnabled({
    enabled: !disableNavigationGuard,
  });
  const visible = useSyncExternalStore(subscribeVisibility, isVisible);
  return (
    visible &&
    focused &&
    (disableNavigationGuard || !stage || stage.step === 'off')
  );
}
