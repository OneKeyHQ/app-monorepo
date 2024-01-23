import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Center, Empty, Spinner, ToastManager } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function LNHardwareWalletAuth({
  children,
  networkId,
  accountId,
}: PropsWithChildren<{
  walletId: string;
  networkId: string;
  accountId: string;
}>) {
  const intl = useIntl();
  const [verifyAuth, setVerifyAuth] = useState(false);
  const [shouldRefreshAuth, setShouldNeedRefreshAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    backgroundApiProxy.serviceLightningNetwork
      .checkAuth({
        networkId,
        accountId,
      })
      .then((shouldRefresh) => {
        setShouldNeedRefreshAuth(shouldRefresh);
        setVerifyAuth(true);
      });
  }, [networkId, accountId]);

  const refreshToken = useCallback(() => {
    setIsLoading(true);
    backgroundApiProxy.serviceLightningNetwork
      .refreshToken({
        networkId,
        accountId,
        password: '',
      })
      .then(() => {
        debugLogger.common.info('refresh lightning network token success');
        setShouldNeedRefreshAuth(false);
      })
      .catch((e) => {
        ToastManager.show(
          {
            title: intl.formatMessage({
              id: 'msg__authentication_failed_verify_again',
            }),
          },
          {
            type: 'error',
          },
        );
        debugLogger.common.info('refresh lightning network token failed: ', e);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [networkId, accountId, intl]);

  if (!verifyAuth) {
    return (
      <Center w="full" h="full">
        <Spinner size="lg" />
      </Center>
    );
  }

  if (!shouldRefreshAuth) {
    return <>{children}</>;
  }

  return (
    <Center w="full" h="full">
      <Empty
        emoji="📇"
        title={intl.formatMessage({ id: 'title__authorize_access' })}
        subTitle={intl.formatMessage({
          id: 'content__connecting_your_hardware_wallet_to_access_the_lightning_account',
        })}
        actionTitle={intl.formatMessage({ id: 'action__connect' })}
        handleAction={() => {
          refreshToken();
        }}
        isLoading={isLoading}
      />
    </Center>
  );
}

export default LNHardwareWalletAuth;
