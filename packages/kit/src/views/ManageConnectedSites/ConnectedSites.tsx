import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { cloneDeep } from 'lodash';
import { Image } from 'native-base';
import natsort from 'natsort';
import { useIntl } from 'react-intl';
import { ListRenderItem } from 'react-native';

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
import { DappSiteConnection } from '@onekeyhq/kit/src/store/reducers/dapp';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useAppSelector } from '../../hooks/redux';
import { wait } from '../../utils/helper';
import { showOverlay } from '../../utils/overlayUtils';

import AddConnectionSiteDialog from './Component/AddConnectionSite';
import ConnectedSitesHeader from './Component/ConnectedSitesHeader';

const sortConnectionsSite = (connections: DappSiteConnection[]) => {
  let parseConnections: DappSiteConnection[] = cloneDeep(connections);
  parseConnections = parseConnections.map<DappSiteConnection>((c) => {
    const { origin } = c.site;
    c.site.hostname = new URL(origin).hostname;
    if (!c.site.icon) c.site.icon = `${origin}/favicon.ico`;
    return c;
  });
  return parseConnections.sort((c1, c2) =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    natsort({ insensitive: true })(c1.site.hostname!, c2.site.hostname!),
  );
};

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
      {shortenAddress(address)}
    </Typography.Body2>
  );
}

export default function ConnectedSites() {
  const intl = useIntl();
  const connections: DappSiteConnection[] = useAppSelector(
    (s) => s.dapp.connections,
  );
  const sortConnections = useMemo(
    () => sortConnectionsSite(connections),
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
                await disconnect();
                closeOverlay();
              },
            },
          }}
          contentProps={{
            icon: (
              <Box
                alignItems="center"
                justifyContent="center"
                size="48px"
                overflow="hidden"
                rounded="full"
                backgroundColor="surface-critical-default"
              >
                <Icon name="ConnectOffOutline" size={24} />
              </Box>
            ),
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
    showOverlay((closeOverlay) => (
      <AddConnectionSiteDialog closeOverlay={closeOverlay} />
    ));
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
          borderRadius={index === connections?.length - 1 ? '12px' : '0px'}
          borderWidth={1}
          borderTopWidth={index === 0 ? 1 : 0}
          borderBottomWidth={index === connections?.length - 1 ? 1 : 0}
          borderColor="border-subdued"
        >
          <Box flexDirection="row" flex={1} alignItems="center">
            {!!item.site.icon && (
              <Box size="32px" overflow="hidden" rounded="full">
                <Image
                  w="full"
                  h="full"
                  src={item.site.icon}
                  key={item.site.icon}
                  alt={item.site.icon}
                  fallbackElement={<Icon name="ConnectOutline" size={32} />}
                />
              </Box>
            )}
            <Box
              flexDirection="column"
              ml="12px"
              justifyContent="center"
              flex={1}
            >
              <Typography.Body1Strong>
                {item.site.hostname}
              </Typography.Body1Strong>
              <ConnectedSiteItemAddress item={item} />
            </Box>
            <IconButton
              name="CloseCircleSolid"
              type="plain"
              circle
              onPress={() => {
                openDeleteDialog(item.site.origin, async () => {
                  await backgroundApiProxy.serviceDapp.cancellConnectedSite(
                    item,
                  );
                });
              }}
            />
          </Box>
        </Box>
      </Pressable>
    ),
    [connections.length, openDeleteDialog],
  );
  return (
    <Modal
      hidePrimaryAction
      header={intl.formatMessage({
        id: 'title__connect_sites',
      })}
      footer={null}
      flatListProps={{
        ListHeaderComponent: (
          <ConnectedSitesHeader
            connections={connections}
            onDisConnectWalletConnected={openDeleteDialog}
            onAddConnectSite={openAddDialog}
          />
        ),
        data: sortConnections,
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
