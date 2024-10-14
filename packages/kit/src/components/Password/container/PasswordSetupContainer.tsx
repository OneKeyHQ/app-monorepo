import { Suspense, memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, Toast, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useBiometricAuthInfo } from '../../../hooks/useBiometricAuthInfo';
import { UniversalContainerWithSuspense } from '../../BiologyAuthComponent/container/UniversalContainer';
import { useWebAuthActions } from '../../BiologyAuthComponent/hooks/useWebAuthActions';
import PasswordSetup from '../components/PasswordSetup';

import type { IPasswordSetupForm } from '../components/PasswordSetup';

interface IPasswordSetupProps {
  onSetupRes: (password: string) => void;
}

interface IBiologyAuthContainerProps {
  webAuthIsSupport?: boolean;
  skipAuth?: boolean;
}

const BiologyAuthContainer = ({
  webAuthIsSupport,
  skipAuth,
}: IBiologyAuthContainerProps) => {
  const [{ isSupport: biologyAuthIsSupport }] =
    usePasswordBiologyAuthInfoAtom();
  const [{ isBiologyAuthSwitchOn }] = useSettingsPersistAtom();
  const intl = useIntl();

  const { title } = useBiometricAuthInfo();
  const settingsTitle = intl.formatMessage(
    { id: ETranslations.auth_with_biometric },
    { biometric: title },
  );

  useEffect(() => {
    if (
      (platformEnv.isExtensionUiPopup || platformEnv.isExtensionUiSidePanel) &&
      isBiologyAuthSwitchOn
    ) {
      void backgroundApiProxy.serviceSetting.setBiologyAuthSwitchOn(false);
    }
  }, [isBiologyAuthSwitchOn]);

  return (biologyAuthIsSupport || webAuthIsSupport) &&
    !platformEnv.isExtensionUiPopup &&
    !platformEnv.isExtensionUiSidePanel ? (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMdMedium">{settingsTitle}</SizableText>
      <Stack>
        <UniversalContainerWithSuspense skipAuth={skipAuth} />
      </Stack>
    </XStack>
  ) : null;
};

const PasswordSetupContainer = ({ onSetupRes }: IPasswordSetupProps) => {
  const intl = useIntl();
  const [loading, setLoading] = useState(false);
  const [{ isSupport }] = usePasswordWebAuthInfoAtom();
  const [{ isBiologyAuthSwitchOn }] = useSettingsPersistAtom();
  const { setWebAuthEnable } = useWebAuthActions();
  const onSetupPassword = useCallback(
    async (data: IPasswordSetupForm) => {
      if (data.confirmPassword !== data.password) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.auth_error_password_not_match,
          }),
        });
      } else {
        setLoading(true);
        try {
          if (isBiologyAuthSwitchOn && isSupport) {
            const res = await setWebAuthEnable(true);
            if (!res) return;
          }
          const encodePassword =
            await backgroundApiProxy.servicePassword.encodeSensitiveText({
              text: data.password,
            });

          const setUpPasswordRes =
            await backgroundApiProxy.servicePassword.setPassword(
              encodePassword,
            );
          onSetupRes(setUpPasswordRes);
          Toast.success({
            title: intl.formatMessage({ id: ETranslations.auth_password_set }),
          });
        } catch (e) {
          console.log('e.stack', (e as Error)?.stack);
          console.error(e);
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.feedback_password_set_failed,
            }),
          });
        } finally {
          setLoading(false);
        }
      }
    },
    [intl, isBiologyAuthSwitchOn, isSupport, onSetupRes, setWebAuthEnable],
  );

  return (
    <PasswordSetup
      loading={loading}
      onSetupPassword={onSetupPassword}
      biologyAuthSwitchContainer={
        <Suspense>
          <BiologyAuthContainer skipAuth webAuthIsSupport={isSupport} />
        </Suspense>
      }
    />
  );
};

export default memo(PasswordSetupContainer);
