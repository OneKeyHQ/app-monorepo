import { useEffect } from 'react';

import { useRouteIsFocusedWhenEnabled } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function NativeStorageRecoveryTestOnHome() {
  const [devSettings] = useDevSettingsPersistAtom();
  const enabled = Boolean(
    platformEnv.isNative &&
    devSettings.enabled &&
    devSettings.settings?.nativeStorageRecoveryTestOnHome,
  );
  const focused = useRouteIsFocusedWhenEnabled({ enabled });
  useEffect(() => {
    if (!enabled || !focused) return;
    let active = true;
    void import('./runNativeStorageRecoveryHomeTest')
      .then(({ runNativeStorageRecoveryHomeTest }) =>
        runNativeStorageRecoveryHomeTest(() => active),
      )
      .catch(() => {
        if (active) {
          appEventBus.emit(EAppEventBusNames.ShowToast, {
            method: 'error',
            title: 'Storage recovery test could not resume',
            message: 'Open Storage recovery tests to retry or clear test data.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [enabled, focused]);
  return null;
}
