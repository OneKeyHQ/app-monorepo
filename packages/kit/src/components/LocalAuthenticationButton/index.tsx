import React, { FC, useCallback } from 'react';

import { useNavigation } from '@react-navigation/core';

import { IconButton } from '@onekeyhq/components';

import { useSettings, useStatus } from '../../hooks/redux';
import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';
import { EnableLocalAuthenticationRoutes } from '../../routes/Modal/EnableLocalAuthentication';
import { ModalRoutes, RootRoutes, RootRoutesParams } from '../../routes/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type LocalAuthenticationButtonProps = { onOk?: (password: string) => void };

type NavigationProps = NativeStackNavigationProp<
  RootRoutesParams,
  RootRoutes.Root
>;

const LocalAuthenticationButton: FC<LocalAuthenticationButtonProps> = ({
  onOk,
}) => {
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
        onOk?.(password);
      }
    }
  }, [
    enableLocalAuthentication,
    navigation,
    onOk,
    localAuthenticate,
    getPassword,
  ]);

  return isOk ? (
    <IconButton
      iconSize={24}
      name={supportFaceId ? 'FaceIdIllus' : 'FingerPrintIllus'}
      onPress={onPress}
    />
  ) : null;
};

export default LocalAuthenticationButton;
