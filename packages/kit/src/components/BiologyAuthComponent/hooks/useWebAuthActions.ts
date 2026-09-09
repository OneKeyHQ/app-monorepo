import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { biologyAuthUtils } from '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils';
import {
  usePasswordModeAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { registerWebAuth, verifiedWebAuth } from '@onekeyhq/shared/src/webAuth';
import { BIOLOGY_AUTH_CANCEL_ERROR } from '@onekeyhq/shared/types/password';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

export const useWebAuthActions = (options?: {
  skipPostVerifyBackgroundTasks?: boolean;
}) => {
  const intl = useIntl();
  const { skipPostVerifyBackgroundTasks } = options || {};
  const [{ webAuthCredentialId: credId }, setPasswordPersist] =
    usePasswordPersistAtom();
  const [passwordMode] = usePasswordModeAtom();

  // Ask the user before registering a NEW passkey when the previously stored
  // one can no longer be verified. WebAuthn cannot tell a lost/deleted platform
  // credential apart from a plain user-cancel (both are NotAllowedError), so we
  // never auto-create — we confirm first. This is what prevents piling up
  // duplicate credentials on repeated enable toggles: an existing valid
  // credential is always reused, and a new one is only created after the user
  // explicitly confirms re-enrollment here.
  const confirmReEnrollPasskey = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        let settled = false;
        const settle = (value: boolean) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        Dialog.show({
          icon: 'FaceIdOutline',
          title: intl.formatMessage({ id: ETranslations.settings_passkey }),
          description: intl.formatMessage(
            { id: ETranslations.global_biometric_disabled_desc },
            {
              authentication: intl.formatMessage({
                id: ETranslations.settings_passkey,
              }),
            },
          ),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_create,
          }),
          onCancelText: intl.formatMessage({ id: ETranslations.global_cancel }),
          onConfirm: () => {
            settle(true);
          },
          onCancel: () => {
            settle(false);
          },
          // Covers dismiss via overlay / close button as a decline.
          onClose: () => {
            settle(false);
          },
        });
      }),
    [intl],
  );

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
                // savePasswordForPasskey reuses an existing, verifiable
                // credential and never auto-creates one. If the stored
                // credential can no longer be authenticated it throws
                // BIOLOGY_AUTH_CANCEL_ERROR (ambiguous: lost credential vs.
                // user-cancel — WebAuthn cannot tell them apart) so we can
                // confirm re-enrollment.
                webAuthCredentialId =
                  (await biologyAuthUtils.savePasswordForPasskey(
                    cachedPassword,
                    {
                      repairBrokenState: true,
                    },
                  )) ?? undefined;
              } catch (e) {
                if ((e as Error)?.name === BIOLOGY_AUTH_CANCEL_ERROR) {
                  // The stored passkey is gone (or the prompt was cancelled).
                  // Ask before registering a fresh one.
                  const shouldReEnroll = await confirmReEnrollPasskey();
                  if (shouldReEnroll) {
                    try {
                      webAuthCredentialId =
                        (await biologyAuthUtils.savePasswordForPasskey(
                          cachedPassword,
                          {
                            forceReEnroll: true,
                          },
                        )) ?? undefined;
                    } catch (reEnrollError) {
                      // forceReEnroll rolled secure storage back to the old
                      // credential on failure. WebAuthSwitchContainer clears the
                      // atom's webAuthCredentialId before entering enable, so
                      // refill it from the restored storage — otherwise
                      // PasswordVerifyContainer / the lock screen would treat
                      // biometric as disabled while storage still holds a usable
                      // credential. (review)
                      const restoredCredId =
                        await biologyAuthUtils.getCredentialId();
                      if (restoredCredId) {
                        setPasswordPersist((v) => ({
                          ...v,
                          webAuthCredentialId: restoredCredId,
                        }));
                      }
                      throw reEnrollError;
                    }
                  } else {
                    return undefined;
                  }
                } else {
                  throw e;
                }
              }
            } catch (e) {
              console.error('Failed to save password to secure storage:', e);
              return undefined;
            } finally {
              await backgroundApiProxy.servicePassword.setSkipPrfCache(false);
            }
          }
        }

        if (!webAuthCredentialId) {
          try {
            // Old WebAuthn path (non-PRF). registerWebAuth reuses an existing,
            // verifiable credId and returns it; it never auto-creates when a
            // credId is supplied. A lost/cancelled credential surfaces as
            // BIOLOGY_AUTH_CANCEL_ERROR (WebAuthn cannot tell a lost credential
            // apart from a plain user-cancel) so we confirm before creating a
            // new one.
            webAuthCredentialId = await registerWebAuth(credId);
          } catch (e) {
            if ((e as Error)?.name === BIOLOGY_AUTH_CANCEL_ERROR) {
              // The stored credential is gone (or the prompt was cancelled).
              // Ask before registering a fresh one — never auto-create.
              const shouldReEnroll = await confirmReEnrollPasskey();
              if (shouldReEnroll) {
                // Create a brand-new credential (no credId → create path).
                webAuthCredentialId = await registerWebAuth();
              } else {
                return undefined;
              }
            } else {
              throw e;
            }
          }
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
    [credId, intl, setPasswordPersist, confirmReEnrollPasskey],
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
            skipPostVerifyBackgroundTasks,
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
  }, [credId, passwordMode, skipPostVerifyBackgroundTasks]);

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
            skipPostVerifyBackgroundTasks,
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
  }, [credId, passwordMode, skipPostVerifyBackgroundTasks]);

  return {
    setWebAuthEnable,
    verifiedPasswordWebAuth,
    checkWebAuth,
    clearWebAuthCredentialId,
  };
};
