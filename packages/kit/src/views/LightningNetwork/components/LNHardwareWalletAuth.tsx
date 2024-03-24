import { type PropsWithChildren, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Spinner, Stack, Toast } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

function LNHardwareWalletAuth({
  children,
  accountId,
  networkId,
}: PropsWithChildren<{
  accountId: string;
  networkId: string;
}>) {
  const intl = useIntl();
  const [verifyAuth, setVerifyAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { result } = usePromiseResult(async () => {
    try {
      const ret = await backgroundApiProxy.serviceLightning.checkAuth({
        accountId,
        networkId,
      });
      return ret;
    } catch {
      return false;
    } finally {
      setVerifyAuth(true);
    }
  }, [networkId, accountId]);

  const refreshToken = useCallback(async () => {
    setIsLoading(true);
    try {
      await backgroundApiProxy.serviceLightning.exchangeToken({
        networkId,
        accountId,
      });
    } catch (e) {
      console.error('refresh lightning network token failed: ', e);
      Toast.error({
        title: intl.formatMessage({
          id: 'msg__authentication_failed_verify_again',
        }),
      });
    } finally {
      setIsLoading(false);
    }
  }, [networkId, accountId, intl]);

  if (!verifyAuth) {
    return (
      <Stack w="full" h="full">
        <Spinner size="large" />
      </Stack>
    );
  }

  if (!result) {
    return <>{children}</>;
  }

  return (
    <Stack w="full" h="full">
      <Empty
        icon="SearchOutline"
        title="Authorize Access"
        description="Connecting your hardware wallet to access the Lightning account"
        buttonProps={{
          children: intl.formatMessage({ id: 'action__connect' }),
          onPress: () => {
            void refreshToken();
          },
          loading: isLoading,
        }}
      />
    </Stack>
  );
}

export default LNHardwareWalletAuth;
