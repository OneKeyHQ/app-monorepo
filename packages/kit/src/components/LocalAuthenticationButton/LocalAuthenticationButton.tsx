/* eslint-disable @typescript-eslint/no-unsafe-call */
import React, {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { AppState, AppStateStatus } from 'react-native';

import { IconButton, useToast } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useLocalAuthentication } from '../../hooks';
import { useAppSelector, useSettings } from '../../hooks/redux';
import { wait } from '../../utils/helper';
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
  const [isLoading, setLoading] = useState(false);
  const loading = useRef(false);
  const toast = useToast();
  const appState = useRef(AppState.currentState);
  const { enableLocalAuthentication, validationState = {} } = useSettings();
  const authenticationType = useAppSelector((s) => s.status.authenticationType);
  const { localAuthenticate, getPassword } = useLocalAuthentication();

  const onLocalAuthenticate = useCallback(async () => {
    if (loading.current) {
      return;
    }
    loading.current = true;
    setLoading(true);
    try {
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
    } finally {
      loading.current = false;
      setLoading(false);
    }
  }, [onOk, onNg, localAuthenticate, getPassword, toast, intl]);

  const onChange = useCallback(
    (nextState: AppStateStatus) => {
      if (appState.current === 'background' && nextState === 'active') {
        if (!field || field !== ValidationFields.Unlock) {
          return;
        }
        if (
          validationState[field] === true ||
          validationState[field] === undefined
        ) {
          onLocalAuthenticate();
        }
      }
      appState.current = nextState;
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
    async function main() {
      if (!field || !enableLocalAuthentication) {
        return;
      }
      if (
        validationState[field] === true ||
        validationState[field] === undefined
      ) {
        await wait(500);
        onLocalAuthenticate();
      }
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IconButton
      isLoading={isLoading}
      size="xl"
      name={
        authenticationType === 'FACIAL' ? 'FaceIdIllus' : 'FingerPrintIllus'
      }
      onPress={onLocalAuthenticate}
    />
  );
};

export default LocalAuthenticationButton;
