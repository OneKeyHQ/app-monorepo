import { Suspense, memo, useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  SizableText,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  usePasswordBiologyAuthInfoAtom,
  usePasswordModeAtom,
  usePasswordPersistAtom,
  usePasswordWebAuthInfoAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPasswordMode } from '@onekeyhq/shared/types/password';

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
  const [, setPasswordPersist] = usePasswordPersistAtom();
  const [passwordMode] = usePasswordModeAtom();
  const { setWebAuthEnable } = useWebAuthActions();
  const onSetupPassword = useCallback(
    async (data: IPasswordSetupForm) => {
      const { confirmPassword, confirmPassCode, passwordMode: mode } = data;
      const finalPassword =
        mode === EPasswordMode.PASSCODE ? confirmPassCode : confirmPassword;
      setLoading(true);
      try {
        if (isBiologyAuthSwitchOn && isSupport) {
          const res = await setWebAuthEnable(true);
          if (!res) return;
        }
        const encodePassword =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: finalPassword,
          });
        const setUpPasswordRes =
          await backgroundApiProxy.servicePassword.setPassword(
            encodePassword,
            mode,
          );
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.auth_passcode_set }),
        });
        Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.auth_Passcode_protection,
          }),
          description: intl.formatMessage({
            id: ETranslations.auth_Passcode_protection_description,
          }),
          renderIcon: (
            <XStack
              w="$14"
              h="$14"
              justifyContent="center"
              alignItems="center"
              bg="$bgCaution"
              borderRadius="$full"
            >
              <Icon
                name="QuestionmarkOutline"
                color="$iconCaution"
                w="$8"
                h="$8"
              />
            </XStack>
          ),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_enable,
          }),
          onConfirm: () => {
            setPasswordPersist((v) => ({
              ...v,
              enablePasswordErrorProtection: true,
            }));
            onSetupRes(setUpPasswordRes);
          },
          onCancel: () => {
            onSetupRes(setUpPasswordRes);
          },
          onClose: () => {
            onSetupRes(setUpPasswordRes);
          },
        });
      } catch (e) {
        console.log('e.stack', (e as Error)?.stack);
        console.error(e);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.feedback_passcode_set_failed,
          }),
        });
      } finally {
        setLoading(false);
      }
    },
    [
      intl,
      isBiologyAuthSwitchOn,
      isSupport,
      onSetupRes,
      setPasswordPersist,
      setWebAuthEnable,
    ],
  );

  return (
    <PasswordSetup
      loading={loading}
      passwordMode={passwordMode}
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
