import React, { FC, useCallback, useEffect, useState } from 'react';

import { Image } from 'native-base';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

import {
  Box,
  Button,
  FlatList,
  Icon,
  IconButton,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { gotoScanQrcode } from '@onekeyhq/kit/src/utils/gotoScanQrcode';

import { useActiveWalletAccount } from '../../../hooks';
import { wait } from '../../../utils/helper';
import { ConnectedSitesHeaderProps } from '../types';

import type { IWalletConnectSession } from '@walletconnect/types';

const ConnectedSitesHeader: FC<ConnectedSitesHeaderProps> = ({
  connections,
  onAddConnectSite,
  onDisConnectWalletConnected,
}) => {
  const intl = useIntl();
  const { accountId, networkId, walletId } = useActiveWalletAccount();
  const [walletConnectSessions, setSessions] = useState<
    IWalletConnectSession[]
  >(() => []);
  useEffect(() => {
    const main = async (delay = 0) => {
      await wait(delay);
      const session =
        await backgroundApiProxy.serviceDapp.getWalletConnectSession();
      setSessions(() => (session ? [session] : []));
    };
    main();
    main(600);
  }, [connections, accountId, networkId, walletId]);

  const renderItem: ListRenderItem<IWalletConnectSession> = useCallback(
    ({ item, index }) => {
      const dappName = item.peerMeta?.name ?? item.peerMeta?.url ?? '';
      const favicon = item?.peerMeta?.icons[0] ?? '';
      return (
        <Pressable>
          <Box
            padding="16px"
            height="76px"
            width="100%"
            bgColor="surface-default"
            borderTopRadius={index === 0 ? '12px' : '0px'}
            borderRadius={
              index === walletConnectSessions?.length - 1 ? '12px' : '0px'
            }
            borderWidth={1}
            borderTopWidth={index === 0 ? 1 : 0}
            borderBottomWidth={
              index === walletConnectSessions?.length - 1 ? 1 : 0
            }
            borderColor="border-subdued"
          >
            <Box alignItems="center" flexDirection="row" flex={1}>
              <Box size="32px" overflow="hidden" rounded="full">
                <Image
                  w="full"
                  h="full"
                  src={favicon}
                  key={favicon}
                  alt={favicon}
                />
              </Box>
              <Box ml="3" flex={1}>
                <Typography.Body2Strong>{dappName}</Typography.Body2Strong>
                <Typography.Body2 color="text-subdued">
                  {shortenAddress(item.accounts[0] ?? '')}
                </Typography.Body2>
              </Box>
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
            </Box>
          </Box>
        </Pressable>
      );
    },
    [onDisConnectWalletConnected, walletConnectSessions.length],
  );
  return (
    <Box>
      <FlatList
        renderItem={renderItem}
        data={walletConnectSessions}
        ListHeaderComponent={
          <Box flexDirection="row" alignItems="center" mb={1} flex={1}>
            <Icon name="WalletconnectLogoIllus" />
            <Typography.Subheading ml="2" color="text-subdued">
              {intl.formatMessage({
                id: 'form__walletconnect__uppercase',
              })}
            </Typography.Subheading>
          </Box>
        }
        ListFooterComponent={
          <Box
            display="flex"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            flex={1}
            mb="1"
            mt="6"
          >
            <Typography.Subheading color="text-subdued">
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
        }
        ListEmptyComponent={
          <Pressable
            borderRadius="12"
            flexDirection="row"
            p="4"
            alignItems="center"
            bg="surface-default"
            onPress={() => {
              gotoScanQrcode();
            }}
          >
            <Box
              display="flex"
              alignItems="center"
              flexDirection="row"
              flex={1}
            >
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
              <Typography.Body2Strong ml="3">
                {intl.formatMessage({
                  id: 'action__scan_to_connect',
                })}
              </Typography.Body2Strong>
            </Box>
          </Pressable>
        }
      />
    </Box>
  );
};

export default React.memo(ConnectedSitesHeader);
