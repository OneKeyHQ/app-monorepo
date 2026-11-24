import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Empty, Spinner, Stack, Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useIsMounted } from '../../../hooks/useIsMounted';
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
  const isMounted = useIsMounted();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );
  const isHardware = accountUtils.isHwAccount({ accountId });
  const [verifyAuth, setVerifyAuth] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { result, run } = usePromiseResult(async () => {
    try {
      const authorized = await backgroundApiProxy.serviceLightning.checkAuth({
        accountId,
        networkId,
      });
      return authorized === true;
    } catch {
      return false;
    } finally {
      if (isMounted.current) setVerifyAuth(true);
    }
  }, [networkId, accountId, isMounted]);

  const refreshToken = useCallback(async () => {
    setIsLoading(true);
    try {
      await backgroundApiProxy.serviceLightning.exchangeToken({
        networkId,
        accountId,
      });
      if (!isMounted.current) return;
      refreshTimer.current = setTimeout(() => {
        if (isMounted.current) void run();
      }, 200);
    } catch (e) {
      if (!isMounted.current) return;
      console.error('refresh lightning network token failed: ', e);
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.ln_authorize_access_network_error,
        }),
      });
    } finally {
      if (isMounted.current) setIsLoading(false);
    }
  }, [networkId, accountId, intl, run, isMounted]);

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
      <Stack
        flex={1}
        testID="LNHardware"
        justifyContent="center"
        alignItems="center"
      >
        <Empty
          icon="PasswordOutline"
          title={intl.formatMessage({ id: ETranslations.ln_authorize_access })}
          description={
            isHardware
              ? intl.formatMessage({
                  id: ETranslations.ln_authorize_access_desc,
                })
              : undefined
          }
          buttonProps={{
            children: intl.formatMessage({
              id: isHardware
                ? ETranslations.global_connect_hardware_wallet
                : ETranslations.global_continue,
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
