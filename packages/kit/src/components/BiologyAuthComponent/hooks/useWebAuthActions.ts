import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ERootRoutes } from '@onekeyhq/shared/src/routes';
import extUtils from '@onekeyhq/shared/src/utils/extUtils';
import { registerWebAuth, verifiedWebAuth } from '@onekeyhq/shared/src/webAuth';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const checkExtWebAuth = async () => {
  if (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) {
    await extUtils.openStandaloneWindow(
      {
        routes: [ERootRoutes.Main],
        params: {
          passkey: true,
        },
      },
      {
        height: 1,
        width: 1,
      },
    );
    return new Promise(() => {});
  }
};

export const useWebAuthActions = () => {
  const intl = useIntl();
  const [{ webAuthCredentialId: credId }, setPasswordPersist] =
    usePasswordPersistAtom();
  const setWebAuthEnable = useCallback(
    async (enable: boolean) => {
      let webAuthCredentialId: string | undefined;
      if (enable) {
        // web auth must be called in ui context for extension
        await checkExtWebAuth();
        webAuthCredentialId = await registerWebAuth(credId);
        if (!webAuthCredentialId) {
          Toast.error({
            title: intl.formatMessage({ id: ETranslations.Toast_web_auth }),
          });
        } else {
          setPasswordPersist((v) => ({
            ...v,
            webAuthCredentialId: webAuthCredentialId ?? '',
          }));
        }
      }
      return webAuthCredentialId;
    },
    [credId, intl, setPasswordPersist],
  );

  const verifiedPasswordWebAuth = useCallback(async () => {
    const checkCachePassword =
      await backgroundApiProxy.servicePassword.getCachedPassword();
    if (!checkCachePassword) {
      throw new Error('No password cached not support web auth');
    }
    await checkExtWebAuth();
    // web auth must be called in ui context for extension
    const cred = await verifiedWebAuth(credId);
    if (cred?.id === credId) {
      return checkCachePassword;
    }
  }, [credId]);

  const checkWebAuth = useCallback(async () => {
    await checkExtWebAuth();
    const cred = await verifiedWebAuth(credId);
    return cred?.id === credId;
  }, [credId]);

  return { setWebAuthEnable, verifiedPasswordWebAuth, checkWebAuth };
};
