/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { FC } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, ToastManager } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useLocalAuthentication } from '../../hooks';
import { useAppSelector } from '../../hooks/redux';
import { AppStatusActiveListener } from '../AppStatusActiveListener';

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
  const lasttime = useRef(0);

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

  useLayoutEffect(() => {
    if (!handOperatedLock) {
      setTimeout(onLocalAuthenticate, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onActive = useCallback(() => {
    const now = Date.now();
    if (now - lasttime.current > 1000) {
      lasttime.current = now;
      onLocalAuthenticate();
    }
  }, [onLocalAuthenticate]);

  return (
    <>
      <IconButton
        isLoading={isLoading}
        size="xl"
        name={
          authenticationType === 'FACIAL'
            ? 'FaceIdOutline'
            : 'FingerPrintOutline'
        }
        onPress={onLocalAuthenticate}
      />
      <AppStatusActiveListener onActive={onActive} />
    </>
  );
};

export default LocalAuthenticationButton;
