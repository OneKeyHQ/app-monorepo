/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { FC } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import * as Burnt from 'burnt';
import { useIntl } from 'react-intl';
import { getTokens } from 'tamagui';

import { Icon, IconButton } from '@onekeyhq/components';

// import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
// import { useAppSelector } from '../../hooks/redux';
import { useLocalAuthentication } from '../../hooks/useLocalAuthentication';
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

  //   const authenticationType = useAppSelector((s) => s.status.authenticationType);
  //   const handOperatedLock = useAppSelector((s) => s.data.handOperatedLock);
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
        console.log('password', password);
        if (password) {
          onOk?.(password);
        }
        // if (password) {
        //   const result = await backgroundApiProxy.serviceApp.verifyPassword(
        //     password,
        //   );
        //   if (result) {
        //     onOk?.(password);
        //     return;
        //   }
        // }
      } else {
        const { error } = localAuthenticateResult;
        if (!error.includes('cancelled')) {
          // ToastManager.show(
          //   {
          //     title: intl.formatMessage({ id: 'msg__verification_failure' }),
          //   },
          //   {
          //     type: 'error',
          //   },
          // );
          Burnt.toast({
            title: intl.formatMessage({ id: 'msg__verification_failure' }),
            haptic: 'error',
            icon: {
              ios: {
                name: 'x.circle.fill',
                color: getTokens().color.iconCriticalLight.val,
              },
              web: <Icon name="XCircleSolid" color="$iconCritical" size="$5" />,
            },
          });
        }
        onNg?.();
      }
    } finally {
      loading.current = false;
      setLoading(false);
    }
  }, [localAuthenticate, getPassword, onOk, onNg, intl]);

  useLayoutEffect(() => {
    // if (!handOperatedLock) {
    //   setTimeout(onLocalAuthenticate, 500);
    // }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onActive = useCallback(() => {
    const now = Date.now();
    if (now - lasttime.current > 1000) {
      lasttime.current = now;
      void onLocalAuthenticate();
    }
  }, [onLocalAuthenticate]);

  // TODO icon name need to be changed
  return (
    <>
      <IconButton
        icon="PlusCircleOutline"
        loading={isLoading}
        size="large"
        onPress={onLocalAuthenticate}
      />
      <AppStatusActiveListener onActive={onActive} />
    </>
  );
};

export default LocalAuthenticationButton;
