import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { AuthenticationType } from 'expo-local-authentication';
import { useIntl } from 'react-intl';

import { SizableText, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  biologyAuthNativeError,
  biologyAuthUtils,
} from '@onekeyhq/kit-bg/src/services/ServicePassword/biologyAuthUtils';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePasswordAtom,
  usePasswordBiologyAuthInfoAtom,
  usePasswordModeAtom,
  usePasswordPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
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
  onVerifyRes: (password: string) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  name?: 'lock';
}

const PasswordVerifyContainer = ({
  onVerifyRes,
  onLayout,
  name,
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
    if (isEnable && isBiologyAuthSwitchOn) {
      void (async () => {
        try {
          const securePassword = await biologyAuthUtils.getPassword();
          setHasSecurePassword(!!securePassword);
        } catch (e) {
          setHasSecurePassword(false);
        }
      })();
    }
  }, [isEnable, isBiologyAuthSwitchOn]);

  useEffect(() => {
    setPasswordAtom((v) => ({
      ...v,
      passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
    }));
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
          (!!webAuthCredentialId && !!hasCachedPassword))
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

  const onBiologyAuthenticate = useCallback(
    async (isExtLockNoCachePassword: boolean) => {
      if (
        passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFYING ||
        passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFIED
      ) {
        return;
      }
      setPasswordAtom((v) => ({
        ...v,
        passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFYING },
      }));
      try {
        if (isExtLockNoCachePassword) {
          const result = await checkWebAuth();
          if (result) {
            setPasswordAtom((v) => ({
              ...v,
              passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFIED },
            }));
            onVerifyRes('');
            resetPasswordErrorAttempts();
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
            setPasswordAtom((v) => ({
              ...v,
              passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFIED },
            }));
            onVerifyRes(biologyAuthRes);
            resetPasswordErrorAttempts();
          } else {
            throw new OneKeyLocalError('biology auth verify error');
          }
        }
      } catch (e: any) {
        const error = e as { message?: string; cause?: string; name?: string };
        let message = error?.message;
        if (verifyPeriodBiologyAuthAttempts >= biologyAuthAttempts) {
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
        if (verifyPeriodBiologyAuthAttempts >= biologyAuthAttempts) {
          setVerifyPeriodBiologyEnable(false);
        } else {
          setVerifyPeriodBiologyAuthAttempts((v) => v + 1);
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
      onVerifyRes,
      passwordMode,
      passwordVerifyStatus.value,
      resetPasswordErrorAttempts,
      setPasswordAtom,
      setVerifyPeriodBiologyAuthAttempts,
      setVerifyPeriodBiologyEnable,
      title,
      verifiedPasswordWebAuth,
      verifyPeriodBiologyAuthAttempts,
    ],
  );

  const resetApp = useResetApp({ silentReset: true });

  const onInputPasswordAuthenticate = useCallback(
    async (data: IPasswordVerifyForm) => {
      if (
        passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFYING ||
        passwordVerifyStatus.value === EPasswordVerifyStatus.VERIFIED
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
        setPasswordAtom((v) => ({
          ...v,
          passwordVerifyStatus: { value: EPasswordVerifyStatus.VERIFIED },
        }));
        if (platformEnv.isNativeAndroid) {
          dismissKeyboard();
          await timerUtils.wait(0);
        }
        onVerifyRes(verifiedPassword);
        resetPasswordErrorAttempts();
      } catch (e) {
        let message = intl.formatMessage({
          id: ETranslations.auth_error_password_incorrect,
        });
        let skipProtection = false;
        if (isLock && enablePasswordErrorProtection) {
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
      onVerifyRes,
      passwordErrorAttempts,
      passwordMode,
      passwordVerifyStatus.value,
      resetApp,
      resetPasswordErrorAttempts,
      setPasswordAtom,
      setPasswordErrorProtectionTimeMinutesSurplus,
      setPasswordPersist,
      setUnlockPeriodPasswordArray,
      unlockPeriodPasswordArray,
    ],
  );

  const [isPasswordEncryptorReady, setIsPasswordEncryptorReady] =
    useState(false);
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

  const loadingView = useMemo(() => {
    return passwordEncryptorInitError ? (
      <SizableText size="$bodyMd" color="$textCritical" textAlign="center">
        {passwordEncryptorInitError}
      </SizableText>
    ) : (
      <Spinner />
    );
  }, [passwordEncryptorInitError]);

  return (
    <Stack onLayout={onLayout}>
      <PasswordVerify
        passwordMode={passwordMode}
        alertText={alertText}
        disableInput={isProtectionTime}
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
