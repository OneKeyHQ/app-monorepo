/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, { FC, useCallback, useEffect, useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';
import { AppState, AppStateStatus } from 'react-native';

import { IconButton } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useLocalAuthentication, useToast } from '../../hooks';
import { useAppSelector, useSettings } from '../../hooks/redux';
import { ValidationFields } from '../Protected/types';

type LocalAuthenticationButtonProps = {
  field?: ValidationFields;
  onOk?: (password: string) => void;
  onNg?: () => void;
};

const LocalAuthenticationButton: FC<LocalAuthenticationButtonProps> = ({
  onOk,
  onNg,
  field,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const { enableLocalAuthentication, validationState = {} } = useSettings();
  const authenticationType = useAppSelector((s) => s.status.authenticationType);
  const { localAuthenticate, getPassword } = useLocalAuthentication();

  const onLocalAuthenticate = useCallback(async () => {
    const localAuthenticateResult = await localAuthenticate();
    if (localAuthenticateResult.success) {
      const password = await getPassword();
      if (password) {
        const result = await backgroundApiProxy.serviceApp.verifyPassword(
          password,
        );
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
  }, [onOk, onNg, localAuthenticate, getPassword, toast, intl]);

  const onChange = useCallback(
    (state: AppStateStatus) => {
      if (!field || state !== 'active' || field !== ValidationFields.Unlock) {
        return;
      }
      if (
        validationState[field] === true ||
        validationState[field] === undefined
      ) {
        onLocalAuthenticate();
      }
    },
    [onLocalAuthenticate, field, validationState],
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
    if (!field || !enableLocalAuthentication) {
      return;
    }
    if (
      validationState[field] === true ||
      validationState[field] === undefined
    ) {
      onLocalAuthenticate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IconButton
      size="xl"
      name={
        authenticationType === 'FACIAL' ? 'FaceIdIllus' : 'FingerPrintIllus'
      }
      onPress={onLocalAuthenticate}
    />
  );
};

export default LocalAuthenticationButton;
