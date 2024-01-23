import { useCallback, useEffect, useMemo, useState } from 'react';

import { cloneDeep } from 'lodash';
import { Image } from 'native-base';
import natsort from 'natsort';
import { useIntl } from 'react-intl';

import {
  Box,
  Dialog,
  Divider,
  Empty,
  Icon,
  IconButton,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { DappSiteConnection } from '@onekeyhq/kit/src/store/reducers/dapp';
import {
  IMPL_ALGO,
  IMPL_CFX,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
  IMPL_TRON,
} from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useAppSelector } from '../../hooks';
import { wait } from '../../utils/helper';
import { showDialog, showOverlay } from '../../utils/overlayUtils';

import AddConnectionSiteDialog from './Component/AddConnectionSite';
import ConnectedSitesHeader from './Component/ConnectedSitesHeader';

import type { ListRenderItem } from 'react-native';

const parseConnectionsSite = (connections: DappSiteConnection[]) => {
  // remove repeat & sort & add hostname
  const parsedConnections: DappSiteConnection[] = cloneDeep(connections);
  const resultConnections: DappSiteConnection[] = [];
  const exitMap = new Map();
  for (const c of parsedConnections) {
    if (c.site.origin) {
      const connectionStr = c.site.origin + c.address + c.networkImpl;
      if (!exitMap.has(connectionStr)) {
        try {
          c.site.hostname = new URL(c.site.origin).hostname;
        } catch (error) {
          console.error(error);
          c.site.hostname = '';
        }
        resultConnections.push(c);
        exitMap.set(connectionStr, 1);
      }
    }
  }
  return resultConnections.sort((c1, c2) =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    natsort({ insensitive: true })(c1.site.hostname!, c2.site.hostname!),
  );
};

const showNetworkLabel = (networkImpl: string) => {
  switch (networkImpl) {
    case IMPL_SOL:
      return 'Solana';
    case IMPL_EVM:
    case IMPL_NEAR:
    case IMPL_ALGO:
    case IMPL_CFX:
    case IMPL_STC:
    case IMPL_TRON:
      return networkImpl.toUpperCase();
    default:
      return '';
  }
};

function ConnectedSiteItemIcon({ item }: { item: DappSiteConnection }) {
  const [favicon, setFavicon] = useState(item.site.icon);
  useEffect(() => {
    if (!item.site.icon) {
      (async () => {
        await wait(0);
        const session =
          await backgroundApiProxy.serviceDapp.getWalletConnectSession();
        // check current walletConnect icon
        setFavicon(() =>
          session && session.peerMeta?.url === item.site.origin
            ? session.peerMeta?.icons[0]
            : `${item.site.origin}/favicon.ico`,
        );
      })();
    }
  }, [item.site.origin, item.site.icon]);
  return (
    <Box size="32px" overflow="hidden" rounded="full">
      <Image
        w="full"
        h="full"
        src={favicon}
        key={favicon}
        alt={favicon}
        fallbackElement={<Icon name="LinkOutline" size={32} />}
      />
    </Box>
  );
}

function ConnectedSiteItemAddress({ item }: { item: DappSiteConnection }) {
  const { serviceDapp } = backgroundApiProxy;
  const { accountId, networkId, walletId } = useActiveWalletAccount();
  const [address, setAddress] = useState(item.address);
  useEffect(() => {
    (async () => {
      await wait(0);
      const accounts = await serviceDapp.getActiveConnectedAccountsAsync({
        origin: item.site.origin,
        impl: item.networkImpl,
      });
      const addr = accounts?.[0]?.address;
      setAddress(addr);
    })();
  }, [
    item.networkImpl,
    item.site.origin,
    serviceDapp,
    accountId,
    networkId,
    walletId,
  ]);

  return (
    <Typography.Body2 color="text-subdued" numberOfLines={1}>
      {`${shortenAddress(address)} · ${showNetworkLabel(item.networkImpl)}`}
    </Typography.Body2>
  );
}

export default function ConnectedSites() {
  const intl = useIntl();
  const connections: DappSiteConnection[] = useAppSelector(
    (s) => s.dapp.connections,
  );
  const parsedConnections = useMemo(
    () => parseConnectionsSite(connections),
    [connections],
  );

  const openDeleteDialog = useCallback(
    (dappName: string, disconnect: () => Promise<any>) => {
      showOverlay((closeOverlay) => (
        <Dialog
          visible
          onClose={closeOverlay}
          footerButtonProps={{
            primaryActionTranslationId: 'action__disconnect',
            primaryActionProps: {
              type: 'destructive',
              onPromise: async () => {
                try {
                  await disconnect();
                } finally {
                  closeOverlay();
                }
              },
            },
            wrap: true,
          }}
          contentProps={{
            iconType: 'danger',
            iconName: 'ConnectOffOutline',
            title: intl.formatMessage({
              id: 'dialog__disconnect_from_this_site',
            }),
            content: intl.formatMessage(
              {
                id: 'dialog__disconnect_all_accounts_desc',
              },
              {
                0: dappName,
              },
            ),
          }}
        />
      ));
    },
    [intl],
  );

  const openAddDialog = useCallback(() => {
    showDialog(<AddConnectionSiteDialog />);
  }, []);

  const renderItem: ListRenderItem<DappSiteConnection> = useCallback(
    ({ item, index }) => (
      <Pressable>
        <Box
          padding="16px"
          height="76px"
          width="100%"
          bgColor="surface-default"
          borderTopRadius={index === 0 ? '12px' : '0px'}
          borderRadius={
            // eslint-disable-next-line no-unsafe-optional-chaining
            index === parsedConnections?.length - 1 ? '12px' : '0px'
          }
          borderWidth={1}
          borderTopWidth={index === 0 ? 1 : 0}
          // eslint-disable-next-line no-unsafe-optional-chaining
          borderBottomWidth={index === parsedConnections?.length - 1 ? 1 : 0}
          borderColor="border-subdued"
        >
          <Box flexDirection="row" flex={1} alignItems="center">
            <ConnectedSiteItemIcon item={item} />
            <Box flexDirection="column" ml="3" justifyContent="center" flex={1}>
              <Typography.Body1Strong>
                {item.site.hostname}
              </Typography.Body1Strong>
              <ConnectedSiteItemAddress item={item} />
            </Box>
            <IconButton
              name="XCircleMini"
              type="plain"
              circle
              onPress={() => {
                openDeleteDialog(item.site.origin, async () => {
                  try {
                    await backgroundApiProxy.serviceDapp.cancelConnectedSite(
                      item,
                    );
                  } catch (error) {
                    console.error('cancelConnectedSite ERROR: ', error);
                    throw error;
                  }
                });
              }}
            />
          </Box>
        </Box>
      </Pressable>
    ),
    [openDeleteDialog, parsedConnections?.length],
  );

  const ListHeaderComponent = useCallback(
    () => (
      <ConnectedSitesHeader
        connections={connections}
        onDisConnectWalletConnected={openDeleteDialog}
        onAddConnectSite={openAddDialog}
      />
    ),
    [connections, openDeleteDialog, openAddDialog],
  );
  return (
    <Modal
      hidePrimaryAction
      maxHeight="560px"
      header={intl.formatMessage({
        id: 'title__connect_sites',
      })}
      footer={null}
      flatListProps={{
        // use function to avoid Header re-render
        ListHeaderComponent, // show WalletConnect alive sessions here
        data: parsedConnections,
        // @ts-ignore
        renderItem,
        ListEmptyComponent: (
          <Box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            height="350px"
          >
            <Empty
              icon={<Icon name="InboxOutline" size={48} />}
              title={intl.formatMessage({
                id: 'empty__no_connected_sites',
              })}
              subTitle={intl.formatMessage({
                id: 'empty__no_connected_sites_desc',
              })}
            />
          </Box>
        ),
        ItemSeparatorComponent: Divider,
        showsVerticalScrollIndicator: false,
      }}
    />
  );
}
