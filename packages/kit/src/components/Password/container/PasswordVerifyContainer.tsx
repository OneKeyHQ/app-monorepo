import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AuthenticationType } from 'expo-local-authentication';
import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { biologyAuthUtils } from '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils';
import {
  useLocalDbOpenErrorAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePasswordAtom,
  usePasswordBiologyAuthInfoAtom,
  usePasswordModeAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { biologyAuthNativeError } from '@onekeyhq/shared/src/biologyAuth/error';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
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

// Fixed (non-i18n) message shown when the local secret envelope platform layer
// (keychain / secure storage / IndexedDB CryptoKey) cannot decrypt the
// verifyString. The password may be correct, so this is intentionally NOT
// treated as a wrong-password attempt.
const SECURE_KEY_UNAVAILABLE_MESSAGE =
  'Local secure key is corrupted or unavailable. Please restart the app.';

// Fixed (non-i18n) fallback shown when a local DB open failure carries no
// underlying message. The original DB error message is preferred whenever
// available. (OK-56874)
const DB_OPEN_ERROR_FALLBACK_MESSAGE = 'DB open unknown error';

interface IPasswordVerifyProps {
  onVerifyRes: (password: string) => void | Promise<void>;
  onLayout?: (e: LayoutChangeEvent) => void;
  name?: 'lock';
  pageMode?: boolean;
  skipPostVerifyBackgroundTasks?: boolean;
}

const PasswordVerifyContainer = ({
  onVerifyRes,
  name,
  pageMode,
  skipPostVerifyBackgroundTasks,
}: IPasswordVerifyProps) => {
  const intl = useIntl();
  const [{ authType, isEnable, isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const { verifiedPasswordWebAuth, checkWebAuth } = useWebAuthActions({
    skipPostVerifyBackgroundTasks,
  });
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
  // OK-56874: the background DB layer publishes a local-database open failure
  // message here. When set, the lock screen surfaces it under the password
  // input immediately (see the effect below), without waiting for a verify
  // attempt.
  const [{ errorMessage: localDbOpenErrorMessage }] = useLocalDbOpenErrorAtom();
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
  // Synchronous guard against concurrent biometric verifications. The VERIFYING
  // status atom is synced from the bg runtime with a delay, so the mount and
  // onActive auto-triggers could otherwise both kick off a verification at the
  // same time. (OK-56875)
  const biologyAuthInProgressRef = useRef(false);
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

  // TODO(biologyAuth-debug): temporary log to diagnose biology auth visibility
  useEffect(() => {
    defaultLogger.setting.page.biologyAuthDebug('PasswordVerifyContainer', {
      platform: platformEnv.symbol,
      isLock,
      pageMode: !!pageMode,
      isExtLockAndNoCachePassword,
      isBiologyAuthSwitchOn,
      verifyPeriodBiologyEnable,
      biologyAuthIsSupport,
      biologyAuthIsEnable: isEnable,
      authType,
      hasSecurePassword,
      hasCachedPassword,
      hasWebAuthCredentialId: !!webAuthCredentialId,
      isBiologyAuthEnable,
    });
  }, [
    isLock,
    pageMode,
    isExtLockAndNoCachePassword,
    isBiologyAuthSwitchOn,
    verifyPeriodBiologyEnable,
    biologyAuthIsSupport,
    isEnable,
    authType,
    hasSecurePassword,
    hasCachedPassword,
    webAuthCredentialId,
    isBiologyAuthEnable,
  ]);

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
      // Avoid the mount + onActive auto-triggers racing into two concurrent
      // verifications while the VERIFYING atom is still syncing from bg.
      // (OK-56875)
      if (biologyAuthInProgressRef.current) {
        return;
      }
      biologyAuthInProgressRef.current = true;
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
                  skipPostVerifyBackgroundTasks,
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
                skipPostVerifyBackgroundTasks,
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
        const isSecureStorageUnavailable = errorUtils.isErrorByClassName({
          error: e,
          className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
        });
        // OK-56874: a local DB open failure (a version downgrade is only one
        // possible cause) preserves its original error message; only fall back
        // to a generic update hint when no underlying message is available.
        const isDbOpenError = errorUtils.isErrorByClassName({
          error: e,
          className: EOneKeyErrorClassNames.LocalDbOpenError,
        });
        // OK-56875: only a genuine wrong password may be shown as "incorrect
        // password". Any other failure (slow KDF / encryptor not ready / system
        // error) must not be mislabeled as a wrong password.
        const isGenuineWrongPassword =
          errorUtils.isErrorByClassName({
            error: e,
            className: EOneKeyErrorClassNames.WrongPassword,
          }) ||
          errorUtils.isErrorByClassName({
            error: e,
            className: EOneKeyErrorClassNames.IncorrectPassword,
          });
        const isCancel = error?.name === BIOLOGY_AUTH_CANCEL_ERROR;
        const isNativeBiometricError = error?.cause === biologyAuthNativeError;
        // `undefined` means "no user-facing error": keep the lock screen in a
        // neutral state and let the flow retry, instead of showing a wrong-
        // password message for a transient failure. (OK-56875)
        let message: string | undefined = error?.message || undefined;
        if (isCancel) {
          message = intl.formatMessage(
            { id: ETranslations.auth_biometric_cancel },
            { biometric: title },
          );
        } else if (isSecureStorageUnavailable) {
          // A secure-storage / keychain outage is not a wrong password.
          message = SECURE_KEY_UNAVAILABLE_MESSAGE;
        } else if (isDbOpenError) {
          // Preserve the original DB open error message instead of masking it;
          // fall back to a fixed English string only when it carries none.
          message = error?.message || DB_OPEN_ERROR_FALLBACK_MESSAGE;
        } else if (isCallbackError && message) {
          // Use the callback error message as-is
        } else if (verifyPeriodBiologyAuthAttempts >= biologyAuthAttempts) {
          message = intl.formatMessage(
            { id: ETranslations.auth_biometric_failed },
            { biometric: title },
          );
        } else if (isGenuineWrongPassword) {
          message = intl.formatMessage({
            id: ETranslations.prime_incorrect_password,
          });
        } else if (isNativeBiometricError) {
          // Native biometric failure (e.g. face not recognized): keep its own
          // message.
        } else {
          // Transient / unexpected failure (e.g. encryptor not ready, slow KDF):
          // do not surface a wrong-password error. (OK-56875)
          message = undefined;
        }
        // Skip biology auth protection for callback errors, secure-storage
        // outages, DB open failures, and transient failures (message
        // undefined): none of these is a real biometric/password attempt.
        if (
          !isCallbackError &&
          !isSecureStorageUnavailable &&
          !isDbOpenError &&
          message !== undefined
        ) {
          if (verifyPeriodBiologyAuthAttempts >= biologyAuthAttempts) {
            setVerifyPeriodBiologyEnable(false);
          } else {
            setVerifyPeriodBiologyAuthAttempts((v) => v + 1);
          }
        }
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus:
            message === undefined
              ? { value: EPasswordVerifyStatus.DEFAULT }
              : { value: EPasswordVerifyStatus.ERROR, message },
        }));
      } finally {
        biologyAuthInProgressRef.current = false;
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
      skipPostVerifyBackgroundTasks,
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
            skipPostVerifyBackgroundTasks,
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
        const isSecureStorageUnavailable = errorUtils.isErrorByClassName({
          error: e,
          className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
        });
        // Only a genuine wrong-password error may drive the wrong-password
        // protection counter / silent app reset. Any other failure (secure-key
        // unavailable, callback failure, or an unexpected/system error such as
        // a corrupted envelope) must never be counted as a password attempt.
        const isGenuineWrongPassword =
          errorUtils.isErrorByClassName({
            error: e,
            className: EOneKeyErrorClassNames.WrongPassword,
          }) ||
          errorUtils.isErrorByClassName({
            error: e,
            className: EOneKeyErrorClassNames.IncorrectPassword,
          });
        // OK-56874: a local DB open failure (a version downgrade is only one
        // possible cause) preserves its original error message rather than
        // masking it, and is not a wrong-password attempt (already excluded from
        // the counter via isGenuineWrongPassword).
        const isDbOpenError = errorUtils.isErrorByClassName({
          error: e,
          className: EOneKeyErrorClassNames.LocalDbOpenError,
        });
        let message: string;
        if (isCallbackError) {
          message =
            errorWithFlag?.message ||
            intl.formatMessage({
              id: ETranslations.global_unknown_error,
            });
        } else if (isSecureStorageUnavailable) {
          message = SECURE_KEY_UNAVAILABLE_MESSAGE;
        } else if (isDbOpenError) {
          // Preserve the original DB open error message instead of masking it;
          // fall back to a fixed English string only when it carries none.
          message = errorWithFlag?.message || DB_OPEN_ERROR_FALLBACK_MESSAGE;
        } else {
          message = intl.formatMessage({
            id: ETranslations.auth_error_password_incorrect,
          });
        }
        let skipProtection = false;
        if (isGenuineWrongPassword && isLock && enablePasswordErrorProtection) {
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
      skipPostVerifyBackgroundTasks,
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

  useEffect(() => {
    void (async () => {
      try {
        await timerUtils.wait(600);
        // Warm up the password encryptor early so the first verification on
        // low-end devices does not race against an unready encryptor. (OK-56875)
        await backgroundApiProxy.servicePassword.waitPasswordEncryptorReady();
      } catch (e) {
        // Do not rethrow: this previously produced an unhandled promise
        // rejection, and the raw error must never surface on the lock screen.
        // The verify flow awaits readiness again before use. (OK-56874)
        console.error('failed to waitPasswordEncryptorReady with error', e);
      }
    })();
  }, []);

  // OK-56874: surface a local DB open failure under the password input as soon
  // as the lock screen mounts (the message is published to the global atom by
  // the background DB layer when `_openDb()` throws), instead of only after the
  // user submits a password / triggers biometric.
  useEffect(() => {
    if (localDbOpenErrorMessage) {
      setPasswordAtom((v) => ({
        ...v,
        passwordVerifyStatus: {
          value: EPasswordVerifyStatus.ERROR,
          message: localDbOpenErrorMessage,
        },
      }));
    }
  }, [localDbOpenErrorMessage, setPasswordAtom]);

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
            // Keep showing a local DB open failure while the user types: it is a
            // terminal error (unlock cannot succeed), so it must not be cleared
            // like a normal wrong-password message. (OK-56874)
            passwordVerifyStatus: localDbOpenErrorMessage
              ? {
                  value: EPasswordVerifyStatus.ERROR,
                  message: localDbOpenErrorMessage,
                }
              : { value: EPasswordVerifyStatus.DEFAULT },
          }));
        }}
        status={passwordVerifyStatus}
        onBiologyAuth={() => onBiologyAuthenticate(isExtLockAndNoCachePassword)}
        onInputPasswordAuth={onInputPasswordAuthenticate}
        isEnable={isBiologyAuthEnable}
        authType={isEnable ? authType : [AuthenticationType.FINGERPRINT]}
      />
    </Stack>
  );
};
export default memo(PasswordVerifyContainer);
