/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { FC } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';
import { AppState } from 'react-native';

import { IconButton, ToastManager } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useLocalAuthentication } from '../../hooks';
import { useAppSelector } from '../../hooks/redux';
import { wait } from '../../utils/helper';

import type { AppStateStatus } from 'react-native';

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
          ToastManager.show(
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
  }, [onOk, onNg, localAuthenticate, getPassword, intl]);

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
