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
import { useAppSelector } from '../../hooks/redux';
import { wait } from '../../utils/helper';

type LocalAuthenticationButtonProps = {
  onOk?: (password: string) => void;
  onNg?: () => void;
};

const LocalAuthenticationButton: FC<LocalAuthenticationButtonProps> = ({
  onOk,
  onNg,
}) => {
  const intl = useIntl();
  const [isLoading, setLoading] = useState(false);
  const loading = useRef(false);
  const toast = useToast();
  const appState = useRef(AppState.currentState);
  const authenticationType = useAppSelector((s) => s.status.authenticationType);
  const handOperatedLock = useAppSelector((s) => s.data.handOperatedLock);
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
      } else {
        const { error } = localAuthenticateResult;
        if (!error.includes('cancelled')) {
          toast.show(
            {
              title: intl.formatMessage({ id: 'msg__verification_failure' }),
            },
            {
              type: 'error',
            },
          );
        }
        onNg?.();
      }
    } finally {
      loading.current = false;
      setLoading(false);
    }
  }, [onOk, onNg, localAuthenticate, getPassword, toast, intl]);

  const onChange = useCallback(
    (nextState: AppStateStatus) => {
      if (appState.current === 'background' && nextState === 'active') {
        onLocalAuthenticate();
      }
      appState.current = nextState;
    },
    [onLocalAuthenticate],
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
      if (handOperatedLock) {
        return;
      }
      await wait(500);
      onLocalAuthenticate();
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <IconButton
      isLoading={isLoading}
      size="xl"
      name={
        authenticationType === 'FACIAL' ? 'FaceIdOutline' : 'FingerPrintOutline'
      }
      onPress={onLocalAuthenticate}
    />
  );
};

export default LocalAuthenticationButton;
