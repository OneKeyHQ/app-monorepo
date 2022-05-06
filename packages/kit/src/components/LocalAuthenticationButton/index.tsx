/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import React, { FC, useCallback, useEffect, useLayoutEffect } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { AppState, AppStateStatus } from 'react-native';

import { IconButton } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useLocalAuthentication, useToast } from '../../hooks';
import { useSettings, useStatus } from '../../hooks/redux';
import { EnableLocalAuthenticationRoutes } from '../../routes/Modal/EnableLocalAuthentication';
import { ModalRoutes, RootRoutes, RootRoutesParams } from '../../routes/types';
import { ValidationFields } from '../Protected/types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type LocalAuthenticationButtonProps = {
  field?: ValidationFields;
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
  field,
}) => {
  const { serviceApp } = backgroundApiProxy;
  const intl = useIntl();
  const toast = useToast();
  const { enableLocalAuthentication, validationState = {} } = useSettings();
  const { authenticationType } = useStatus();
  const navigation = useNavigation<NavigationProps>();
  const { isOk, localAuthenticate, getPassword } = useLocalAuthentication();

  const onValidate = useCallback(async () => {
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
  }, [onOk, onNg, localAuthenticate, getPassword, serviceApp, toast, intl]);

  const onPress = useCallback(() => {
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
    onValidate();
  }, [enableLocalAuthentication, navigation, onValidate]);

  const onChange = useCallback(
    (state: AppStateStatus) => {
      if (state !== 'active' || field !== ValidationFields.Unlock) {
        return;
      }
      if (
        (field && validationState[field] === true) ||
        validationState[field] === undefined
      ) {
        onValidate();
      }
    },
    [onValidate, field, validationState],
  );

  // for app unlock
  useEffect(() => {
    const subscription = AppState.addEventListener('change', onChange);
    return () => {
      // @ts-ignore
      if (subscription) {
        // @ts-ignore
        subscription?.remove();
      } else {
        AppState.removeEventListener('change', onChange);
      }
    };
  }, [onChange]);

  useLayoutEffect(() => {
    if (!enableLocalAuthentication) {
      return;
    }
    if (!field || field === ValidationFields.Unlock) {
      return;
    }
    if (
      validationState[field] === true ||
      validationState[field] === undefined
    ) {
      onValidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (
    !isOk ||
    !enableLocalAuthentication ||
    (field && validationState[field] === false)
  ) {
    return null;
  }

  return (
    <IconButton
      size="xl"
      name={
        authenticationType === 'FACIAL' ? 'FaceIdIllus' : 'FingerPrintIllus'
      }
      onPress={onPress}
    />
  );
};

export default LocalAuthenticationButton;
