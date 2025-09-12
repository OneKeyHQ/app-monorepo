import { useCallback } from 'react';

import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export const useOnLock = () => {
  const [passwordSetting] = usePasswordPersistAtom();
  const onLock = useCallback(async () => {
    if (passwordSetting.isPasswordSet) {
      await backgroundApiProxy.servicePassword.lockApp();
    } else {
      await backgroundApiProxy.servicePassword.promptPasswordVerify();
      await backgroundApiProxy.servicePassword.lockApp();
    }
    defaultLogger.setting.page.lockNow();
  }, [passwordSetting.isPasswordSet]);
  return onLock;
};
