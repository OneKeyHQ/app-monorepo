import React, { useEffect, useMemo, useState } from 'react';

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

import { ExternalAccountImg } from '../../components/WalletConnect/ExternalAccountImg';
import { WALLET_CONNECT_SHOW_DISCONNECT_BUTTON_DELAY } from '../../components/WalletConnect/walletConnectConsts';
import walletConnectUtils from '../../components/WalletConnect/walletConnectUtils';
import useAppNavigation from '../../hooks/useAppNavigation';
import { TxDetailActionBox } from '../TxDetail/components/TxDetailActionBox';

import { IWalletConnectExternalAccountInfo } from './types';

const AuthExternalAccountInfo = React.memo(
  (props: IWalletConnectExternalAccountInfo) => {
    const {
      session,
      // walletService,
      currentAccount,
      currentNetwork,
      accountInfo,
      client,
    } = props;
    const intl = useIntl();
    const navigation = useAppNavigation();
    const walletName = accountInfo?.walletName;

    const [retryVisible, setRetryVisible] = useState(false);
    useEffect(() => {
      if (session?.connected) {
        const timer = setTimeout(
          () => setRetryVisible(true),
          WALLET_CONNECT_SHOW_DISCONNECT_BUTTON_DELAY,
        );
        return () => {
          clearTimeout(timer);
          setRetryVisible(false);
        };
      }
    }, [session?.connected]);
    const connectionIndicator = useMemo(() => {
      let color = 'icon-default';
      if (client?.connector?.isTransportOpen) {
        color = 'icon-warning';
      }
      if (client?.connector?.isTransportOpen && session?.connected) {
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
    }, [client?.connector?.isTransportOpen, session?.connected]);
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

                await walletConnectUtils.terminateWcConnection({
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
