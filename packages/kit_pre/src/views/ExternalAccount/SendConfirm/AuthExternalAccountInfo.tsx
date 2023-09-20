import { memo, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  HStack,
  Spinner,
  Text,
  VStack,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import { terminateWcConnection } from '../../../components/WalletConnect/utils/terminateWcConnection';
import { WALLET_CONNECT_SEND_SHOW_DISCONNECT_BUTTON_DELAY } from '../../../components/WalletConnect/walletConnectConsts';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { TxDetailActionBox } from '../../TxDetail/components/TxDetailActionBox';
import ExternalAccountImg from '../components/ExternalAccountImg';

import type {
  ISendAuthenticationModalTitleInfo,
  IWalletConnectExternalAccountInfo,
} from '../../Send/types';

const AuthExternalAccountInfo = memo(
  (
    props: IWalletConnectExternalAccountInfo & {
      setTitleInfo: (titleInfo: ISendAuthenticationModalTitleInfo) => void;
    },
  ) => {
    const {
      session,
      // walletService,
      currentAccount,
      currentNetwork,
      accountInfo,
      client,
      setTitleInfo,
      injectedConnectorInfo,
    } = props;
    const intl = useIntl();
    const navigation = useAppNavigation();
    const walletName = accountInfo?.walletName;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const externalAccountType = accountInfo?.type;
    const wcSessionConnected = session?.connected;
    const { connected } = useMemo(() => {
      const $connected = injectedConnectorInfo
        ? injectedConnectorInfo.isConnected
        : wcSessionConnected;
      return {
        connected: $connected,
      };
    }, [injectedConnectorInfo, wcSessionConnected]);

    useEffect(() => {
      setTitleInfo({
        title: intl.formatMessage(
          { id: 'action__connect_str' },
          {
            0: walletName,
          },
        ),
        subTitle: currentNetwork.name,
      });
    }, [currentNetwork.name, intl, setTitleInfo, walletName]);

    const [retryVisible, setRetryVisible] = useState(false);
    useEffect(() => {
      if (connected && !injectedConnectorInfo) {
        const timer = setTimeout(
          () => setRetryVisible(true),
          WALLET_CONNECT_SEND_SHOW_DISCONNECT_BUTTON_DELAY,
        );
        return () => {
          clearTimeout(timer);
          setRetryVisible(false);
        };
      }
    }, [injectedConnectorInfo, connected]);
    const connectionIndicator = useMemo(() => {
      let color = 'icon-default';
      if (client?.connector?.isTransportOpen) {
        color = 'icon-warning';
      }
      if (client?.connector?.isTransportOpen && connected) {
        color = 'interactive-default';
      }
      if (injectedConnectorInfo && connected) {
        color = 'interactive-default';
      }
      return (
        <Box
          position="absolute"
          top="-4px"
          right="10px"
          w={3}
          h={3}
          bgColor={color}
          borderWidth={2}
          borderColor="surface-default"
          borderRadius="full"
        />
      );
    }, [client?.connector?.isTransportOpen, connected, injectedConnectorInfo]);
    return (
      <VStack flex={1}>
        <HStack alignItems="center">
          <Spinner />
          <Text typography="PageHeading" ml={3}>
            {intl.formatMessage({ id: 'content__connecting' })}...
          </Text>
        </HStack>

        <HStack mt={6} mb={8} alignItems="center">
          <Box>
            <ExternalAccountImg
              size={10}
              accountId={currentAccount.id}
              radius="12px"
              mr={3}
            />
            {connectionIndicator}
          </Box>
          <Text typography="Heading">{walletName}</Text>
        </HStack>
        <TxDetailActionBox
          details={[
            {
              title: intl.formatMessage({ id: 'form__account' }),
              content: shortenAddress(currentAccount.address),
            },
            {
              title: intl.formatMessage({ id: 'network__network' }),
              content: currentNetwork.name,
            },
          ]}
        />
        {retryVisible ? (
          <>
            <Text typography="Body2" mt={8}>
              {intl.formatMessage(
                { id: 'content__disconnect_and_try_again' },
                { 0: walletName },
              )}
            </Text>
            <Button
              alignSelf="flex-start"
              mt={4}
              size="lg"
              onPress={async () => {
                // TODO confirm and hint

                await terminateWcConnection({
                  client,
                  walletUrl: accountInfo?.walletUrl,
                });

                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              }}
            >
              {intl.formatMessage({ id: 'action__disconnect' })}
            </Button>
          </>
        ) : null}
      </VStack>
    );
  },
);
AuthExternalAccountInfo.displayName = 'AuthExternalAccountInfo';

export { AuthExternalAccountInfo };
