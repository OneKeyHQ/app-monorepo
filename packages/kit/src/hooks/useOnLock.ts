import { useCallback } from 'react';

import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export const useOnLock = () => {
  const [passwordSetting] = usePasswordPersistAtom();
  const onLock = useCallback(async () => {
    if (
      travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
      'travel-mode'
    ) {
      return;
    }
    if (passwordSetting.isPasswordSet) {
      await backgroundApiProxy.servicePassword.lockApp({ manual: true });
    } else {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.servicePassword.lockApp();
    }
    defaultLogger.setting.page.lockNow();
  }, [passwordSetting.isPasswordSet]);
  return onLock;
};
