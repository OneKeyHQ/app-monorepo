import type { FC } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';

import { Image } from 'native-base';
import { useIntl } from 'react-intl';

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

import Speedindicator from '../../../components/NetworkAccountSelector/modals/NetworkAccountSelectorModal/SpeedIndicator';
import { useActiveWalletAccount, useAppSelector } from '../../../hooks';
import { wait } from '../../../utils/helper';

import type { IWalletConnectUniversalSession } from '../../../components/WalletConnect/types';
import type { ConnectedSitesHeaderProps } from '../types';
import type { ListRenderItem } from 'react-native';

const ConnectedSitesHeader: FC<ConnectedSitesHeaderProps> = ({
  connections,
  onAddConnectSite,
  onDisConnectWalletConnected,
}) => {
  const intl = useIntl();
  const { accountId, networkId, walletId } = useActiveWalletAccount();
  const [walletConnectSessions, setSessions] = useState<
    IWalletConnectUniversalSession[]
  >(() => []);
  const refreshConnectedSitesTs = useAppSelector(
    (s) => s.refresher.refreshConnectedSitesTs,
  );
  const [status, setStatus] = useState<{ connected?: boolean }>({
    connected: false,
  });
  useEffect(() => {
    const main = async (delay = 0) => {
      await wait(delay);
      const sessionV1 =
        await backgroundApiProxy.serviceDapp.getWalletConnectSession();
      const { sessions: sessionsV2 } =
        await backgroundApiProxy.serviceDapp.getWalletConnectSessionV2();
      const sessions: IWalletConnectUniversalSession[] = [];
      if (sessionV1) {
        sessions.push({ sessionV1 });
      }
      sessionsV2.forEach((sessionV2) => {
        sessions.push({ sessionV2 });
      });
      setSessions(() => sessions);
      const s =
        await backgroundApiProxy.walletConnect.checkWssConnectionStatusV2();
      setStatus(s);
    };
    main();
    main(600);
  }, [connections, refreshConnectedSitesTs, accountId, networkId, walletId]);

  const renderItem: ListRenderItem<IWalletConnectUniversalSession> =
    useCallback(
      ({ item, index }) => {
        let dappName = '';
        let favicon = '';
        let accounts: string[] = [];
        if (item.sessionV1) {
          dappName =
            item.sessionV1?.peerMeta?.name ??
            item.sessionV1?.peerMeta?.url ??
            '';
          favicon = item.sessionV1?.peerMeta?.icons?.[0] ?? '';
          accounts = item.sessionV1?.accounts ?? [];
        }
        if (item.sessionV2) {
          dappName =
            item.sessionV2?.peer?.metadata?.name ??
            item.sessionV2?.peer?.metadata?.url ??
            '';
          favicon = item.sessionV2?.peer?.metadata?.icons?.[0] ?? '';
          accounts =
            item.sessionV2?.namespaces?.eip155?.accounts?.[0]
              ?.split(':')
              ?.slice(-1) || [];
        }
        return (
          <Pressable>
            <Box
              padding="16px"
              height="76px"
              width="100%"
              bgColor="surface-default"
              borderTopRadius={index === 0 ? '12px' : '0px'}
              borderRadius={
                // eslint-disable-next-line no-unsafe-optional-chaining
                index === walletConnectSessions?.length - 1 ? '12px' : '0px'
              }
              borderWidth={1}
              borderTopWidth={index === 0 ? 1 : 0}
              borderBottomWidth={
                // eslint-disable-next-line no-unsafe-optional-chaining
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
                  <Typography.Body2Strong noOfLines={2}>
                    {dappName}
                  </Typography.Body2Strong>
                  <Typography.Body2 color="text-subdued">
                    {accounts[0]
                      ? `${shortenAddress(accounts[0] ?? '0x000000')} · EVM`
                      : 'EVM'}
                  </Typography.Body2>
                </Box>
                <IconButton
                  name="XCircleMini"
                  type="plain"
                  circle
                  onPress={() => {
                    onDisConnectWalletConnected(dappName, async () => {
                      try {
                        if (item.sessionV1) {
                          await backgroundApiProxy.walletConnect.disconnect();
                        }
                        if (item.sessionV2) {
                          await backgroundApiProxy.walletConnect.disconnectV2({
                            sessionV2: item.sessionV2,
                          });
                        }
                        await wait(600);
                      } finally {
                        backgroundApiProxy.walletConnect.refreshConnectedSites();
                      }
                    });
                  }}
                />
              </Box>
            </Box>
          </Pressable>
        );
      },
      [onDisConnectWalletConnected, walletConnectSessions?.length],
    );
  return (
    <Box>
      <FlatList
        renderItem={renderItem}
        data={walletConnectSessions}
        ListHeaderComponent={
          <Box flexDirection="column">
            <Box
              flexDirection="row"
              alignItems="center"
              justifyContent="space-around"
              flex={1}
            >
              <Button
                type="basic"
                leftIconName="PlusMini"
                iconSize={20}
                size="lg"
                flex={1}
                mr="4"
                onPress={onAddConnectSite}
              >
                {intl.formatMessage({
                  id: 'action__add',
                })}
              </Button>
              <Button
                type="basic"
                size="lg"
                flex={1}
                leftIconName="ViewfinderCircleMini"
                iconSize={20}
                onPress={() => {
                  gotoScanQrcode();
                }}
              >
                {intl.formatMessage({
                  id: 'action__scan',
                })}
              </Button>
            </Box>
            <Box flexDirection="row" alignItems="center" mb={1} mt={3} flex={1}>
              <Icon name="WalletconnectLogoIllus" />
              <Typography.Subheading ml="2" color="text-subdued">
                {intl.formatMessage({
                  id: 'form__walletconnect__uppercase',
                })}
              </Typography.Subheading>
              <Box ml="2">
                <Speedindicator
                  borderWidth={0}
                  backgroundColor={
                    // 'icon-success' | 'icon-warning' | 'icon-critical'
                    status.connected ? 'icon-success' : 'icon-critical'
                  }
                />
              </Box>
            </Box>
          </Box>
        }
        ListFooterComponent={
          <Box
            display="flex"
            flexDirection="row"
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
                <Icon name="ViewfinderCircleMini" size={20} />
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

export default memo(ConnectedSitesHeader);
