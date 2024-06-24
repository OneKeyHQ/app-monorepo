import { type PropsWithChildren, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Spinner, Stack, Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import HomeSelector from '../../Home/components/HomeSelector';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { HomeHeaderContainer } from '../../Home/pages/HomeHeaderContainer';

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
  const { result, run } = usePromiseResult(async () => {
    try {
      await backgroundApiProxy.serviceLightning.checkAuth({
        accountId,
        networkId,
      });
      return true;
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
      setTimeout(() => {
        void run();
      }, 200);
    } catch (e) {
      console.error('refresh lightning network token failed: ', e);
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.ln_authorize_access_network_error,
        }),
      });
    } finally {
      setIsLoading(false);
    }
  }, [networkId, accountId, intl, run]);

  if (!verifyAuth) {
    return (
      <Stack w="100%" h="100%" alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </Stack>
    );
  }

  if (result) {
    return <>{children}</>;
  }

  return (
    <Stack testID="LNHardwareAuth" w="100%" h="100%">
      <HomeTokenListProviderMirror>
        <Stack testID="Wallet-Tab-Header" p="$5">
          <HomeSelector mb="$2.5" />
        </Stack>
      </HomeTokenListProviderMirror>
      <Stack
        flex={1}
        testID="LNHardware"
        justifyContent="center"
        alignItems="center"
      >
        <Empty
          icon="PasswordOutline"
          title={intl.formatMessage({ id: ETranslations.ln_authorize_access })}
          description={intl.formatMessage({
            id: ETranslations.ln_authorize_access_desc,
          })}
          buttonProps={{
            children: intl.formatMessage({
              id: ETranslations.global_connect_hardware_wallet,
            }),
            onPress: () => {
              void refreshToken();
            },
            loading: isLoading,
          }}
        />
      </Stack>
    </Stack>
  );
}

export default LNHardwareWalletAuth;
