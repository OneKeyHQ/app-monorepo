import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { PASSCODE_PROTECTION_ATTEMPTS_MESSAGE_SHOW_MAX } from '@onekeyhq/shared/types/password';

const usePasswordProtection = (isLock: boolean) => {
  const [unlockPeriodPasswordArray, setUnlockPeriodPasswordArray] = useState<
    string[]
  >([]);
  const intl = useIntl();
  const [
    passwordErrorProtectionTimeMinutesSurplus,
    setPasswordErrorProtectionTimeMinutesSurplus,
  ] = useState(0);
  const [verifyPeriodBiologyAuthAttempts, setVerifyPeriodBiologyAuthAttempts] =
    useState(0);
  const [verifyPeriodBiologyEnable, setVerifyPeriodBiologyEnable] =
    useState(true);
  const [
    {
      passwordErrorAttempts,
      enablePasswordErrorProtection,
      passwordErrorProtectionTime,
    },
    setPasswordPersist,
  ] = usePasswordPersistAtom();

  const isProtectionTime = useMemo(
    () =>
      isLock &&
      enablePasswordErrorProtection &&
      passwordErrorAttempts >= PASSCODE_PROTECTION_ATTEMPTS_MESSAGE_SHOW_MAX &&
      passwordErrorProtectionTime > Date.now(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isLock,
      enablePasswordErrorProtection,
      passwordErrorAttempts,
      passwordErrorProtectionTime,
      passwordErrorProtectionTimeMinutesSurplus,
    ],
  );

  const alertText = useMemo(() => {
    if (isProtectionTime && passwordErrorProtectionTimeMinutesSurplus > 0) {
      return intl.formatMessage(
        {
          id: ETranslations.auth_passcode_cooldown,
        },
        {
          cooldowntime: `${Math.floor(
            passwordErrorProtectionTimeMinutesSurplus,
          )}`,
        },
      );
    }
    return '';
  }, [isProtectionTime, passwordErrorProtectionTimeMinutesSurplus, intl]);

  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const protectionTimeRun = useCallback(() => {
    if (passwordErrorProtectionTime < Date.now()) {
      setPasswordErrorProtectionTimeMinutesSurplus(0);
    } else {
      const timeMinutes =
        (passwordErrorProtectionTime - Date.now()) / 60_000 + 1;
      setPasswordErrorProtectionTimeMinutesSurplus(timeMinutes);
    }
  }, [passwordErrorProtectionTime]);

  useEffect(() => {
    if (isProtectionTime) {
      protectionTimeRun();
      intervalRef.current = setInterval(() => {
        protectionTimeRun();
      }, 1000 * 5);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [
    alertText,
    isProtectionTime,
    passwordErrorProtectionTime,
    protectionTimeRun,
  ]);

  return {
    unlockPeriodPasswordArray,
    passwordErrorProtectionTimeMinutesSurplus,
    verifyPeriodBiologyAuthAttempts,
    verifyPeriodBiologyEnable,
    passwordErrorAttempts,
    alertText,
    setPasswordPersist,
    setVerifyPeriodBiologyEnable,
    setVerifyPeriodBiologyAuthAttempts,
    setUnlockPeriodPasswordArray,
    setPasswordErrorProtectionTimeMinutesSurplus,
    enablePasswordErrorProtection,
    isProtectionTime,
  };
};

export default usePasswordProtection;
