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
import extUtils, {
  EPassKeyWindowType,
} from '@onekeyhq/shared/src/utils/extUtils';
import { registerWebAuth, verifiedWebAuth } from '@onekeyhq/shared/src/webAuth';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const checkExtWebAuth = async (type: EPassKeyWindowType) => {
  // https://support.google.com/chrome/answer/13168025?hl=en&co=GENIE.Platform%3DDesktop
  // in Windows:
  //  store passkeys in Windows Hello.
  // in MacOS:
  //  store passkeys in iCloud KeyChain or Chrome Password Manager.
  // in Linux:
  //  store passkeys in KeePassXC.
  // in ChromeOS:
  //  store passkeys in ChromeOS Password Vault.

  // Bug:
  // In macOS's Chrome, the passkey window from Chrome password manager cannot be opened in a popup or sidebar window,
  //  so a separate pop-up window needs to be opened.
  if (platformEnv.isExtensionUiSidePanel && platformEnv.isRuntimeMacOSBrowser) {
    await extUtils.openPassKeyWindow(type);
    return new Promise(() => {});
  }
};

export const useWebAuthActions = () => {
  const intl = useIntl();
  const [{ webAuthCredentialId: credId }, setPasswordPersist] =
    usePasswordPersistAtom();
  const [passwordMode] = usePasswordModeAtom();
  const setWebAuthEnable = useCallback(
    async (enable: boolean) => {
      let webAuthCredentialId: string | undefined;
      if (enable) {
        // web auth must be called in ui context for extension
        await checkExtWebAuth(EPassKeyWindowType.create);
        webAuthCredentialId = await registerWebAuth(credId);
        if (!webAuthCredentialId) {
          Toast.error({
            title: intl.formatMessage({ id: ETranslations.toast_web_auth }),
          });
        } else {
          setPasswordPersist((v) => ({
            ...v,
            webAuthCredentialId: webAuthCredentialId ?? '',
          }));
          // Save password to secure storage for biometric unlock
          try {
            if (platformEnv.isExtension) {
              const isPasswordSet =
                await backgroundApiProxy.servicePassword.checkPasswordSet();
              if (isPasswordSet) {
                await backgroundApiProxy.servicePassword.promptPasswordVerify();
              }
            }
            const cachedPassword =
              await backgroundApiProxy.servicePassword.getCachedPassword();
            if (cachedPassword) {
              await biologyAuthUtils.savePassword(cachedPassword);
            }
          } catch (e) {
            console.error('Failed to save password to secure storage:', e);
          }
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
      await checkExtWebAuth(EPassKeyWindowType.unlock);
      // web auth must be called in ui context for extension
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
    } catch {
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
    } catch {
      // Fallback to credential-only verification
    }
    await checkExtWebAuth(EPassKeyWindowType.unlock);
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
