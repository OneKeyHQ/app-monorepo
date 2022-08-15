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
      walletService,
      currentAccount,
      currentNetwork,
      accountInfo,
      client,
    } = props;
    const intl = useIntl();
    const navigation = useAppNavigation();
    const walletName = useMemo(() => {
      let name =
        accountInfo?.walletName ||
        session?.peerMeta?.name ||
        walletService?.name ||
        '';
      name = name.replace('🌈 ', '');
      return name;
    }, [accountInfo?.walletName, session?.peerMeta?.name, walletService?.name]);

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
      let color = '#888888';
      if (client?.connector?.isTransportOpen) {
        color = '#f2be45';
      }
      if (client?.connector?.isTransportOpen && session?.connected) {
        color = '#529c54';
      }
      return <Box ml={4} bgColor={color} w={2} h={2} borderRadius="16px" />;
    }, [client?.connector?.isTransportOpen, session?.connected]);
    return (
      <VStack flex={1}>
        <HStack alignItems="center">
          <Text typography="PageHeading">
            {intl.formatMessage({ id: 'content__you_are_going_to_connect' })}
          </Text>
          <Box w={2} />
          <Spinner />
        </HStack>

        <HStack mt={6} mb={8} alignItems="center">
          <ExternalAccountImg
            size={10}
            accountId={currentAccount.id}
            radius="12px"
            mr={3}
          />
          <Text typography="Heading">{walletName}</Text>
          {connectionIndicator}
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
        <Box flex={1} />
        {retryVisible ? (
          <Button
            size="xl"
            type="destructive"
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
            {`Disconnect ${walletName}`}
            {/* {intl.formatMessage({ id: 'action_retry' })} */}
          </Button>
        ) : null}
      </VStack>
    );
  },
);
AuthExternalAccountInfo.displayName = 'AuthExternalAccountInfo';

export { AuthExternalAccountInfo };
