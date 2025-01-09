import { useMemo } from 'react';

import { AuthenticationType } from 'expo-local-authentication';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { usePasswordBiologyAuthInfoAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const useBiometricAuthInfo = () => {
  const [{ authType }] = usePasswordBiologyAuthInfoAtom();
  const intl = useIntl();
  return useMemo(() => {
    let icon: IKeyOfIcons = 'TouchIdSolid';
    let titleId =
      platformEnv.isNativeIOS || platformEnv.isDesktopMac
        ? ETranslations.global_touch_id
        : ETranslations.global_biometric;

    if (platformEnv.isNative) {
      if (
        authType.includes(AuthenticationType.FACIAL_RECOGNITION) ||
        authType.includes(AuthenticationType.IRIS)
      ) {
        if (platformEnv.isNativeIOS) {
          titleId = ETranslations.global_face_id;
        }
        icon = 'FaceIdSolid';
      }
    } else if (platformEnv.isDesktopWin) {
      titleId = ETranslations.global_windows_hello;
      icon = 'WindowsHelloSolid';
    } else if (platformEnv.isExtension) {
      titleId = ETranslations.settings_passkey;
      icon = 'PassKeySolid';
    }

    return {
      title: intl.formatMessage({ id: titleId }),
      icon,
    };
  }, [authType, intl]);
};
