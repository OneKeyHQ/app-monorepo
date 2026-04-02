import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { biologyAuthUtils } from '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils';
import {
  usePasswordModeAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { registerWebAuth, verifiedWebAuth } from '@onekeyhq/shared/src/webAuth';
import { BIOLOGY_AUTH_CANCEL_ERROR } from '@onekeyhq/shared/types/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const useWebAuthActions = () => {
  const intl = useIntl();
  const [{ webAuthCredentialId: credId }, setPasswordPersist] =
    usePasswordPersistAtom();
  const [passwordMode] = usePasswordModeAtom();

  const setWebAuthEnable = useCallback(
    async (enable: boolean) => {
      let webAuthCredentialId: string | undefined;
      if (enable) {
        if (platformEnv.isExtension) {
          const isPasswordSet =
            await backgroundApiProxy.servicePassword.checkPasswordSet();
          if (isPasswordSet) {
            let cachedPassword =
              await backgroundApiProxy.servicePassword.getCachedPassword();
            if (!cachedPassword) {
              await backgroundApiProxy.servicePassword.promptPasswordVerify();
              cachedPassword =
                await backgroundApiProxy.servicePassword.getCachedPassword();
            }

            if (!cachedPassword) {
              return undefined;
            }

            try {
              // Force a real PRF auth during enrollment so enabling PassKey
              // still requires one biometric interaction.
              await backgroundApiProxy.servicePassword.setSkipPrfCache(true);
              try {
                webAuthCredentialId =
                  (await biologyAuthUtils.savePasswordForPasskey(
                    cachedPassword,
                    {
                      repairBrokenState: true,
                    },
                  )) ?? undefined;
              } finally {
                await backgroundApiProxy.servicePassword.setSkipPrfCache(false);
              }
            } catch (e) {
              console.error('Failed to save password to secure storage:', e);
              return undefined;
            }
          }
        }

        if (!webAuthCredentialId) {
          webAuthCredentialId = await registerWebAuth(credId);
        }

        if (!webAuthCredentialId) {
          Toast.error({
            title: intl.formatMessage({ id: ETranslations.toast_web_auth }),
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

  const clearWebAuthCredentialId = useCallback(async () => {
    setPasswordPersist((v) => ({
      ...v,
      webAuthCredentialId: '',
    }));
  }, [setPasswordPersist]);

  const verifiedPasswordWebAuth = useCallback(async () => {
    const checkCachePassword =
      await backgroundApiProxy.servicePassword.getCachedPassword();
    if (checkCachePassword) {
      const cred = await verifiedWebAuth(credId);
      if (cred?.id === credId) {
        return checkCachePassword;
      }
      return undefined;
    }
    // No cached password — try secure storage (triggers WebAuthn PRF)
    try {
      const securePassword = await biologyAuthUtils.getPassword();
      if (securePassword) {
        // Verify password correctness and cache it
        const verified =
          await backgroundApiProxy.servicePassword.verifyPassword({
            password: securePassword,
            passwordMode,
          });
        return verified;
      }
    } catch (e) {
      if ((e as Error)?.name === BIOLOGY_AUTH_CANCEL_ERROR) {
        throw e;
      }
      // No secure password stored — fall through
    }
    return undefined;
  }, [credId, passwordMode]);

  const checkWebAuth = useCallback(async () => {
    // Try secure storage first (WebAuthn PRF)
    try {
      const securePassword = await biologyAuthUtils.getPassword();
      if (securePassword) {
        // Verify password correctness and cache it
        const verified =
          await backgroundApiProxy.servicePassword.verifyPassword({
            password: securePassword,
            passwordMode,
          });
        return verified;
      }
    } catch (e) {
      if ((e as Error)?.name === BIOLOGY_AUTH_CANCEL_ERROR) {
        throw e;
      }
      // Fallback to credential-only verification
    }
    const cred = await verifiedWebAuth(credId);
    return cred?.id === credId;
  }, [credId, passwordMode]);

  return {
    setWebAuthEnable,
    verifiedPasswordWebAuth,
    checkWebAuth,
    clearWebAuthCredentialId,
  };
};
