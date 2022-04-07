import React, { FC, useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useLocalAuthentication, useToast } from '../../hooks';
import { useSettings, useStatus } from '../../hooks/redux';
import { EnableLocalAuthenticationRoutes } from '../../routes/Modal/EnableLocalAuthentication';
import { ModalRoutes, RootRoutes, RootRoutesParams } from '../../routes/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type LocalAuthenticationButtonProps = {
  onOk?: (password: string) => void;
  onNg?: () => void;
};

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;

const LocalAuthenticationButton: FC<LocalAuthenticationButtonProps> = ({
  onOk,
  onNg,
}) => {
  const { serviceApp } = backgroundApiProxy;
  const intl = useIntl();
  const toast = useToast();
  const { enableLocalAuthentication } = useSettings();
  const { supportFaceId } = useStatus();
  const navigation = useNavigation<NavigationProps>();

  const { isOk, localAuthenticate, getPassword } = useLocalAuthentication();

  const onPress = useCallback(async () => {
    if (!enableLocalAuthentication) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.EnableLocalAuthentication,
        params: {
          screen:
            EnableLocalAuthenticationRoutes.EnableLocalAuthenticationModal,
        },
      });
      return;
    }
    const localAuthenticateResult = await localAuthenticate();
    if (localAuthenticateResult.success) {
      const password = await getPassword();
      if (password) {
        const result = await serviceApp.verifyPassword(password);
        if (result) {
          onOk?.(password);
          return;
        }
      }
    }
    toast.show({
      title: intl.formatMessage({ id: 'msg__verification_failure' }),
    });
    onNg?.();
  }, [
    enableLocalAuthentication,
    navigation,
    onOk,
    onNg,
    localAuthenticate,
    getPassword,
    serviceApp,
    toast,
    intl,
  ]);

  return isOk ? (
    <IconButton
      size="xl"
      name={supportFaceId ? 'FaceIdIllus' : 'FingerPrintIllus'}
      onPress={onPress}
    />
  ) : null;
};

export default LocalAuthenticationButton;
