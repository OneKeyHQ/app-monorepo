import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AuthenticationType } from 'expo-local-authentication';
import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { biologyAuthUtils } from '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePasswordAtom,
  usePasswordBiologyAuthInfoAtom,
  usePasswordModeAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { biologyAuthNativeError } from '@onekeyhq/shared/src/biologyAuth/error';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  BIOLOGY_AUTH_ATTEMPTS_FACE,
  BIOLOGY_AUTH_ATTEMPTS_FINGERPRINT,
  BIOLOGY_AUTH_CANCEL_ERROR,
  EPasswordMode,
  EPasswordVerifyStatus,
  PASSCODE_PROTECTION_ATTEMPTS,
  PASSCODE_PROTECTION_ATTEMPTS_MESSAGE_SHOW_MAX,
  PASSCODE_PROTECTION_ATTEMPTS_PER_MINUTE_MAP,
} from '@onekeyhq/shared/types/password';

import { useBiometricAuthInfo } from '../../../hooks/useBiometricAuthInfo';
import { useResetApp } from '../../../views/Setting/hooks';
import { useWebAuthActions } from '../../BiologyAuthComponent/hooks/useWebAuthActions';
import PasswordVerify from '../components/PasswordVerify';
import usePasswordProtection from '../hooks/usePasswordProtection';

import type { IPasswordVerifyForm } from '../components/PasswordVerify';
import type { LayoutChangeEvent } from 'react-native';

interface IPasswordVerifyProps {
  onVerifyRes: (password: string) => void | Promise<void>;
  onLayout?: (e: LayoutChangeEvent) => void;
  name?: 'lock';
  pageMode?: boolean;
}

const PasswordVerifyContainer = ({
  onVerifyRes,
  name,
  pageMode,
}: IPasswordVerifyProps) => {
  const intl = useIntl();
  const [{ authType, isEnable }] = usePasswordBiologyAuthInfoAtom();
  const { verifiedPasswordWebAuth, checkWebAuth } = useWebAuthActions();
  const [{ webAuthCredentialId }] = usePasswordPersistAtom();
  const [{ isBiologyAuthSwitchOn }] = useSettingsPersistAtom();
  const [hasCachedPassword, setHasCachedPassword] = useState(false);
  const [hasSecurePassword, setHasSecurePassword] = useState(true);
  const [passwordMode] = usePasswordModeAtom();
  const { title } = useBiometricAuthInfo();
  const biologyAuthAttempts = useMemo(
    () =>
      authType.includes(AuthenticationType.FACIAL_RECOGNITION)
        ? BIOLOGY_AUTH_ATTEMPTS_FACE
        : BIOLOGY_AUTH_ATTEMPTS_FINGERPRINT,
    [authType],
  );
  const isLock = useMemo(() => name === 'lock', [name]);
  const isExtLockAndNoCachePassword = Boolean(
    platformEnv.isExtension && isLock && !hasCachedPassword,
  );
  const [{ passwordVerifyStatus }, setPasswordAtom] = usePasswordAtom();
  const resetPasswordStatus = useCallback(() => {
    void backgroundApiProxy.servicePassword.resetPasswordStatus();
  }, []);
  useEffect(() => {
    if (webAuthCredentialId && isBiologyAuthSwitchOn) {
      void (async () => {
        setHasCachedPassword(
          !!(await backgroundApiProxy.servicePassword.getCachedPassword()),
        );
      })();
    }
  }, [webAuthCredentialId, isBiologyAuthSwitchOn]);

  useEffect(() => {
    const shouldCheck =
      (isEnable || (platformEnv.isExtension && !!webAuthCredentialId)) &&
      isBiologyAuthSwitchOn;
    if (shouldCheck) {
      void (async () => {
        try {
          const hasPassword = await biologyAuthUtils.hasPassword();
          setHasSecurePassword(hasPassword);
        } catch (_e) {
          setHasSecurePassword(false);
        }
      })();
    }
  }, [isEnable, isBiologyAuthSwitchOn, webAuthCredentialId]);

  const passwordVerifyStatusRef = useRef(passwordVerifyStatus);
  useEffect(() => {
    if (
      passwordVerifyStatusRef.current.value === EPasswordVerifyStatus.VERIFYING
    ) {
      setPasswordAtom((v) => ({
        ...v,
        passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
      }));
    }
  }, [setPasswordAtom]);

  useEffect(
    () => () => {
      resetPasswordStatus();
    },
    [resetPasswordStatus],
  );

  const {
    verifyPeriodBiologyEnable,
    verifyPeriodBiologyAuthAttempts,
    unlockPeriodPasswordArray,
    passwordErrorAttempts,
    setVerifyPeriodBiologyEnable,
    setVerifyPeriodBiologyAuthAttempts,
    setPasswordErrorProtectionTimeMinutesSurplus,
    setUnlockPeriodPasswordArray,
    alertText,
    setPasswordPersist,
    isProtectionTime,
    enablePasswordErrorProtection,
  } = usePasswordProtection(isLock);

  const isBiologyAuthEnable = useMemo(
    // both webAuth or biologyAuth are enabled
    () => {
      if (isExtLockAndNoCachePassword) {
        return (
          isBiologyAuthSwitchOn &&
          !!webAuthCredentialId &&
          verifyPeriodBiologyEnable
        );
      }
      return (
        isBiologyAuthSwitchOn &&
        verifyPeriodBiologyEnable &&
        ((isEnable && hasSecurePassword) ||
          (!!webAuthCredentialId && (!!hasCachedPassword || hasSecurePassword)))
      );
    },
    [
      isExtLockAndNoCachePassword,
      isBiologyAuthSwitchOn,
      verifyPeriodBiologyEnable,
      isEnable,
      hasSecurePassword,
      webAuthCredentialId,
      hasCachedPassword,
    ],
  );

  const resetPasswordErrorAttempts = useCallback(() => {
    if (isLock && enablePasswordErrorProtection) {
      setPasswordPersist((v) => ({
        ...v,
        passwordErrorAttempts: 0,
        passwordErrorProtectionTime: 0,
      }));
    }
    setVerifyPeriodBiologyEnable(true);
    setVerifyPeriodBiologyAuthAttempts(0);
    setPasswordErrorProtectionTimeMinutesSurplus(0);
  }, [
    setPasswordPersist,
    isLock,
    enablePasswordErrorProtection,
    setVerifyPeriodBiologyEnable,
    setVerifyPeriodBiologyAuthAttempts,
    setPasswordErrorProtectionTimeMinutesSurplus,
  ]);

  // Helper function to handle callback errors in pageMode
  const throwCallbackError = useCallback(
    (callbackError: unknown): never => {
      const errorMessage =
        (callbackError as Error)?.message ||
        intl.formatMessage({
          id: ETranslations.global_unknown_error,
        });
      const callbackErr = new Error(errorMessage) as Error & {
        isCallbackError: boolean;
      };
      callbackErr.isCallbackError = true;
      throw callbackErr;
    },
    [intl],
  );

  // Helper function to call onVerifyRes with proper error handling
  const callOnVerifyRes = useCallback(
    async (verifiedPassword: string) => {
      if (pageMode) {
        try {
          await onVerifyRes(verifiedPassword);
        } catch (callbackError) {
          // In pageMode, if callback throws error, rethrow with original error message
          throwCallbackError(callbackError);
        }
      } else {
        setTimeout(() => {
          void onVerifyRes(verifiedPassword);
        });
      }
    },
    [pageMode, onVerifyRes, throwCallbackError],
  );

  // Helper function to set verified status and reset error attempts
  const setVerifiedStatus = useCallback(() => {
    setPasswordAtom((v) => ({
      ...v,
      passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFIED },
    }));
    resetPasswordErrorAttempts();
  }, [setPasswordAtom, resetPasswordErrorAttempts]);

  const onBiologyAuthenticate = useCallback(
    async (isExtLockNoCachePassword: boolean) => {
      if (
        passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFYING ||
        (!pageMode &&
          passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFIED)
      ) {
        return;
      }
      setPasswordAtom((v) => ({
        ...v,
        passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFYING },
      }));
      try {
        if (isExtLockNoCachePassword) {
          // Try to retrieve password from secure storage (WebAuthn PRF)
          try {
            const securePassword = await biologyAuthUtils.getPassword();
            if (securePassword) {
              const verifiedPassword =
                await backgroundApiProxy.servicePassword.verifyPassword({
                  password: securePassword,
                  passwordMode,
                });
              await callOnVerifyRes(verifiedPassword);
              setVerifiedStatus();
              return;
            }
          } catch (e) {
            if ((e as Error)?.name === BIOLOGY_AUTH_CANCEL_ERROR) {
              throw e;
            }
            // No secure password stored — fall through to credential-only
          }
          // Fallback: old behavior (credential-only verification).
          // Call checkWebAuth directly — note it may retry getPassword()
          // internally but the PRF master key should be cached from the
          // first attempt, avoiding a redundant user prompt.
          const result = await checkWebAuth();
          if (result) {
            await callOnVerifyRes(typeof result === 'string' ? result : '');
            setVerifiedStatus();
          } else {
            throw new OneKeyLocalError('biology auth verify error');
          }
        } else {
          let biologyAuthRes;
          if (!isEnable && isBiologyAuthEnable) {
            // webAuth verify
            biologyAuthRes = await verifiedPasswordWebAuth();
          } else {
            biologyAuthRes =
              await backgroundApiProxy.servicePassword.verifyPassword({
                password: '',
                isBiologyAuth: true,
                passwordMode,
              });
          }
          if (biologyAuthRes) {
            await callOnVerifyRes(biologyAuthRes);
            setVerifiedStatus();
          } else {
            throw new OneKeyLocalError('biology auth verify error');
          }
        }
      } catch (e: any) {
        console.error('onBiologyAuthenticate error', e);
        const error = e as {
          message?: string;
          cause?: string;
          name?: string;
        } & { isCallbackError?: boolean };
        const isCallbackError = error?.isCallbackError === true;
        let message = error?.message;
        // For callback errors in pageMode, use the original error message directly
        if (isCallbackError && message) {
          // Use the callback error message as-is
        } else if (verifyPeriodBiologyAuthAttempts >= biologyAuthAttempts) {
          message = intl.formatMessage(
            {
              id: ETranslations.auth_biometric_failed,
            },
            {
              biometric: title,
            },
          );
        } else if (!message || error?.cause !== biologyAuthNativeError) {
          message = intl.formatMessage({
            id: ETranslations.prime_incorrect_password,
          });
        }
        if (error?.name === BIOLOGY_AUTH_CANCEL_ERROR) {
          message = intl.formatMessage(
            {
              id: ETranslations.auth_biometric_cancel,
            },
            { biometric: title },
          );
        }
        // Skip biology auth protection logic for callback errors in pageMode
        // because biology auth verification was successful, only the callback failed
        if (!isCallbackError) {
          if (verifyPeriodBiologyAuthAttempts >= biologyAuthAttempts) {
            setVerifyPeriodBiologyEnable(false);
          } else {
            setVerifyPeriodBiologyAuthAttempts((v) => v + 1);
          }
        }
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: {
            value: EPasswordVerifyStatus.ERROR,
            message,
          },
        }));
      }
    },
    [
      biologyAuthAttempts,
      checkWebAuth,
      intl,
      isBiologyAuthEnable,
      isEnable,
      passwordMode,
      passwordVerifyStatus.value,
      pageMode,
      setPasswordAtom,
      setVerifyPeriodBiologyAuthAttempts,
      setVerifyPeriodBiologyEnable,
      title,
      verifiedPasswordWebAuth,
      verifyPeriodBiologyAuthAttempts,
      callOnVerifyRes,
      setVerifiedStatus,
    ],
  );

  const resetApp = useResetApp({ silentReset: true });

  const onInputPasswordAuthenticate = useCallback(
    async (data: IPasswordVerifyForm) => {
      if (
        isProtectionTime ||
        passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFYING ||
        (!pageMode &&
          passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFIED)
      ) {
        return;
      }
      setPasswordAtom((v) => ({
        ...v,
        passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFYING },
      }));
      const finalPassword =
        passwordMode === EPasswordMode.PASSWORD ? data.password : data.passCode;
      try {
        const encodePassword =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: finalPassword,
          });
        const verifiedPassword =
          await backgroundApiProxy.servicePassword.verifyPassword({
            password: encodePassword,
            passwordMode,
          });
        if (platformEnv.isNativeAndroid) {
          dismissKeyboard();
          await timerUtils.wait(0);
        }
        await callOnVerifyRes(verifiedPassword);
        setVerifiedStatus();
        // Backfill secure storage once for migrated extension users whose
        // biometric switch is on but password was never stored with PRF.
        // This runs for any successful manual password verification flow.
        if (platformEnv.isExtension && isBiologyAuthSwitchOn) {
          try {
            const hasSecurePasswordNow = await biologyAuthUtils.hasPassword();
            if (!hasSecurePasswordNow) {
              await backgroundApiProxy.servicePassword.setSkipPrfCache(false);
              const prfCredentialId =
                await biologyAuthUtils.savePasswordForPasskey(
                  verifiedPassword,
                  {
                    repairBrokenState: true,
                  },
                );
              setHasSecurePassword(await biologyAuthUtils.hasPassword());
              if (prfCredentialId && prfCredentialId !== webAuthCredentialId) {
                setPasswordPersist((v) => ({
                  ...v,
                  webAuthCredentialId: prfCredentialId,
                }));
              }
            } else if (!hasSecurePassword) {
              setHasSecurePassword(true);
            }
          } catch (e) {
            console.error('Failed to backfill secure storage password:', e);
          }
        }
      } catch (e) {
        const errorWithFlag = e as Error & { isCallbackError?: boolean };
        const isCallbackError = errorWithFlag?.isCallbackError === true;
        let message = isCallbackError
          ? errorWithFlag?.message ||
            intl.formatMessage({
              id: ETranslations.global_unknown_error,
            })
          : intl.formatMessage({
              id: ETranslations.auth_error_password_incorrect,
            });
        let skipProtection = false;
        // Skip password protection logic for callback errors in pageMode
        // because password verification was successful, only the callback failed
        if (!isCallbackError && isLock && enablePasswordErrorProtection) {
          let nextAttempts = passwordErrorAttempts + 1;
          if (!unlockPeriodPasswordArray.includes(finalPassword)) {
            setPasswordPersist((v) => ({
              ...v,
              passwordErrorAttempts: nextAttempts,
            }));
            setUnlockPeriodPasswordArray((v) => [...v, finalPassword]);
          } else {
            nextAttempts = passwordErrorAttempts;
            skipProtection = true;
          }
          if (nextAttempts >= PASSCODE_PROTECTION_ATTEMPTS) {
            defaultLogger.setting.page.resetApp({
              reason: 'WrongPasscodeMaxAttempts',
            });
            await resetApp();
          } else if (
            nextAttempts >= PASSCODE_PROTECTION_ATTEMPTS_MESSAGE_SHOW_MAX &&
            !skipProtection
          ) {
            const timeMinutes =
              PASSCODE_PROTECTION_ATTEMPTS_PER_MINUTE_MAP[
                nextAttempts.toString()
              ];
            message = intl.formatMessage(
              {
                id: ETranslations.auth_passcode_failed_alert,
              },
              {
                count: PASSCODE_PROTECTION_ATTEMPTS - nextAttempts,
              },
            );
            setPasswordPersist((v) => ({
              ...v,
              passwordErrorAttempts: nextAttempts,
              passwordErrorProtectionTime: Date.now() + timeMinutes * 60 * 1000, // 2s for animation
            }));
            setPasswordErrorProtectionTimeMinutesSurplus(timeMinutes);
          }
        }
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: {
            value: EPasswordVerifyStatus.ERROR,
            message,
          },
        }));
      }
    },
    [
      enablePasswordErrorProtection,
      intl,
      isLock,
      isProtectionTime,
      passwordErrorAttempts,
      passwordMode,
      passwordVerifyStatus.value,
      pageMode,
      resetApp,
      hasSecurePassword,
      setPasswordAtom,
      setPasswordErrorProtectionTimeMinutesSurplus,
      setPasswordPersist,
      setUnlockPeriodPasswordArray,
      unlockPeriodPasswordArray,
      callOnVerifyRes,
      setVerifiedStatus,
      isBiologyAuthSwitchOn,
      webAuthCredentialId,
    ],
  );

  const [_, setIsPasswordEncryptorReady] = useState(false);
  const [passwordEncryptorInitError, setPasswordEncryptorInitError] =
    useState('');
  useEffect(() => {
    void (async () => {
      try {
        setPasswordEncryptorInitError('');
        await timerUtils.wait(600);
        const isReady =
          await backgroundApiProxy.servicePassword.waitPasswordEncryptorReady();
        if (isReady) {
          setIsPasswordEncryptorReady(isReady);
        }
      } catch (e) {
        console.error('failed to waitPasswordEncryptorReady with error', e);
        const errorMessage = (e as Error)?.message || '';
        if (errorMessage) {
          // setPasswordEncryptorInitError(errorMessage);
          // Toast.error({
          //   title: errorMessage,
          //   message: 'Please restart the app and try again later',
          // });
        }
        throw e;
      }
    })();
  }, []);

  return (
    <Stack>
      <PasswordVerify
        pageMode={pageMode}
        passwordMode={passwordMode}
        alertText={alertText}
        confirmBtnDisabled={isProtectionTime}
        onPasswordChange={() => {
          setPasswordAtom((v) => ({
            ...v,
            passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
          }));
        }}
        status={passwordVerifyStatus}
        onBiologyAuth={() => onBiologyAuthenticate(isExtLockAndNoCachePassword)}
        onInputPasswordAuth={onInputPasswordAuthenticate}
        isEnable={isBiologyAuthEnable}
        authType={isEnable ? authType : [AuthenticationType.FINGERPRINT]}
      />
      {passwordEncryptorInitError ? (
        <SizableText
          size="$bodyMd"
          color="$textCritical"
          textAlign="center"
          mt="$2"
        >
          {passwordEncryptorInitError}
        </SizableText>
      ) : null}
    </Stack>
  );
};
export default memo(PasswordVerifyContainer);
