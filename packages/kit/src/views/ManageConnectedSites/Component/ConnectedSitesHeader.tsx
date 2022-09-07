import React, { FC } from 'react';

import { Image } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Icon,
  IconButton,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { gotoScanQrcode } from '@onekeyhq/kit/src/utils/gotoScanQrcode';

import { ConnectedSitesHeaderProps } from '../types';

const ConnectedSitesHeader: FC<ConnectedSitesHeaderProps> = ({
  walletConnectSession,
  onAddConnectSite,
  onDisConnectWalletConnected,
}) => {
  const intl = useIntl();
  const isConnected = walletConnectSession
    ? walletConnectSession.connected
    : false;
  const dappName =
    walletConnectSession?.peerMeta?.name ??
    walletConnectSession?.peerMeta?.url ??
    '';
  const favicon = walletConnectSession?.peerMeta?.icons[0] ?? '';
  return (
    <Box>
      <Box
        display="flex"
        flexDirection="row"
        alignItems="center"
        mb={1}
        flex={1}
      >
        <Icon name="WalletconnectLogoIllus" />
        <Typography.Subheading ml="2" color="text-subdued">
          {intl.formatMessage({
            id: 'form__walletconnect__uppercase',
          })}
        </Typography.Subheading>
      </Box>

      <Pressable
        onPress={() => {
          if (!isConnected) {
            gotoScanQrcode();
          }
        }}
        borderRadius="12"
        flexDirection="row"
        p="4"
        alignItems="center"
        bg="surface-default"
      >
        <Box display="flex" alignItems="center" flexDirection="row" flex={1}>
          {isConnected ? (
            <Box size="32px" overflow="hidden" rounded="full">
              <Image
                w="full"
                h="full"
                src={favicon}
                key={favicon}
                alt={favicon}
              />
            </Box>
          ) : (
            <Box
              alignItems="center"
              justifyContent="center"
              size="32px"
              overflow="hidden"
              rounded="full"
              backgroundColor="surface-neutral-default"
            >
              <Icon name="ScanSolid" size={20} />
            </Box>
          )}
          <Box ml="2" flex={1}>
            <Typography.Body2Strong>
              {isConnected
                ? dappName
                : intl.formatMessage({
                    id: 'action__scan_to_connect',
                  })}
            </Typography.Body2Strong>
            {isConnected ? (
              <Typography.Body2 color="text-subdued">
                {shortenAddress(walletConnectSession?.accounts[0] ?? '')}
              </Typography.Body2>
            ) : null}
          </Box>
        </Box>
        {isConnected ? (
          <IconButton
            name="CloseCircleSolid"
            type="plain"
            circle
            onPress={() => {
              onDisConnectWalletConnected(dappName, async () => {
                await backgroundApiProxy.walletConnect.disconnect();
              });
            }}
          />
        ) : null}
      </Pressable>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        flex={1}
        mb="1"
        mt="6"
      >
        <Typography.Subheading>
          {intl.formatMessage({
            id: 'title__connect_sites',
          })}
        </Typography.Subheading>
        <Button
          type="plain"
          size="sm"
          leftIcon={<Icon name="PlusSolid" size={16} />}
          onPress={onAddConnectSite}
        >
          {intl.formatMessage({
            id: 'action__add',
            defaultMessage: 'Add',
          })}
        </Button>
      </Box>
    </Box>
  );
};

export default React.memo(ConnectedSitesHeader);
