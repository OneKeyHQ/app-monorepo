import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { registerWebAuth, verifiedWebAuth } from '@onekeyhq/shared/src/webAuth';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const useWebAuthActions = () => {
  const intl = useIntl();
  const [{ webAuthCredentialId: credId }, setPasswordPersist] =
    usePasswordPersistAtom();
  const setWebAuthEnable = useCallback(
    async (enable: boolean) => {
      let webAuthCredentialId: string | undefined;
      if (enable) {
        // web auth must be called in ui context for extension
        webAuthCredentialId = await registerWebAuth();
        if (!webAuthCredentialId) {
          Toast.error({
            title: intl.formatMessage({ id: ETranslations.Toast_web_auth }),
          });
        }
      }
      setPasswordPersist((v) => ({
        ...v,
        webAuthCredentialId: webAuthCredentialId ?? '',
      }));
      return webAuthCredentialId;
    },
    [intl, setPasswordPersist],
  );

  const verifiedPasswordWebAuth = useCallback(async () => {
    const checkCachePassword =
      await backgroundApiProxy.servicePassword.getCachedPassword();
    if (!checkCachePassword) {
      throw new Error('No password cached not support web auth');
    }
    // web auth must be called in ui context for extension
    const cred = await verifiedWebAuth(credId);
    if (cred?.id === credId) {
      return checkCachePassword;
    }
  }, [credId]);

  return { setWebAuthEnable, verifiedPasswordWebAuth };
};
