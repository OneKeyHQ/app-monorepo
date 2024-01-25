import { useCallback } from 'react';

import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { registerWebAuth } from '@onekeyhq/shared/src/webAuth';

export const useWebAuthActions = () => {
  const [, setPasswordPersist] = usePasswordPersistAtom();
  const setWebAuthEnable = useCallback(
    async (enable: boolean) => {
      let webAuthCredentialId: string | undefined;
      if (enable) {
        // register web auth must be called in ui context
        webAuthCredentialId = await registerWebAuth();
      }
      setPasswordPersist((v) => ({
        ...v,
        webAuthCredentialId: webAuthCredentialId ?? '',
      }));
    },
    [setPasswordPersist],
  );

  return { setWebAuthEnable };
};
