import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Divider,
  HStack,
  Icon,
  IconButton,
  List,
  Modal,
  Pressable,
  ToastManager,
  Token,
  Typography,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useManageNetworks, useNavigation, useWallet } from '../../../hooks';
import { useAllNetworksWalletAccounts } from '../../../hooks/useAllNetwoks';
import { navigationShortcuts } from '../../../routes/navigationShortcuts';
import { ModalRoutes, RootRoutes, TabRoutes } from '../../../routes/routesEnum';
import BaseMenu from '../../Overlay/BaseMenu';
import { ReceiveTokenModalRoutes } from '../../ReceiveToken/types';
import { AllNetworksEmpty } from '../../Wallet/AssetsList/EmptyList';
import { allNetworksSelectAccount } from '../hooks';
import { ManageNetworkModalRoutes } from '../types';

import type { ManageNetworkRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/core';
import type { ListRenderItem } from 'react-native';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.AllNetworksNetworkSelector
>;

type DataListItem = {
  networkId: string;
  accounts: Account[];
};

export const AllNetworksAccountsDetail: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();

  const { walletId, accountId } = route?.params ?? {};
  const { data: allNetworksAccountsMap } = useAllNetworksWalletAccounts({
    walletId,
  });

  const { wallet } = useWallet({ walletId });

  const { allNetworks } = useManageNetworks();

  const data = useMemo(
    () =>
      Object.entries(allNetworksAccountsMap).map(([id, accounts]) => ({
        networkId: id,
        accounts,
      })),
    [allNetworksAccountsMap],
  );

  const copyAddress = useCallback(
    ({ account, network }: { account: Account; network: Network }) => {
      if (!account) {
        return;
      }
      const { address, displayAddress, template } = account;
      if (wallet?.type === 'hw') {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Receive,
          params: {
            screen: ReceiveTokenModalRoutes.ReceiveToken,
            params: {
              address,
              displayAddress,
              wallet,
              network,
              account,
              template,
            },
          },
        });
      } else {
        if (!displayAddress && !address) return;
        copyToClipboard(displayAddress ?? address ?? '');
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__address_copied' }),
        });
      }
    },
    [intl, wallet, navigation],
  );

  const onCopyAddress = useCallback(
    ({ networkId, accounts }: DataListItem) => {
      allNetworksSelectAccount({
        networkId,
        accounts,
      }).then((res) => {
        if (res) {
          copyAddress(res);
        }
      });
    },
    [copyAddress],
  );

  const getMenus = useCallback(
    (params: { networkId: string; accounts: Account[] }) =>
      [
        {
          id: 'action__view_account',
          onPress: async ({
            network,
            account,
          }: {
            network: Network;
            account: Account;
          }) => {
            const { serviceNetwork, serviceAccount } = backgroundApiProxy;
            await serviceNetwork.changeActiveNetwork(network?.id);
            await serviceAccount.changeActiveAccountByAccountId(account?.id);

            navigationShortcuts.navigateToAppRootTab(TabRoutes.Home);
          },
          icon: 'UserOutline',
        },
        {
          id: 'action__show_full_address',
          onPress: ({
            network,
            account,
          }: {
            network: Network;
            account: Account;
          }) => {
            if (!wallet) {
              return;
            }
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.ManageNetwork,
              params: {
                screen:
                  ManageNetworkModalRoutes.AllNetworksShowAccountFullAddress,
                params: {
                  wallet,
                  network,
                  account,
                },
              },
            });
          },
          icon: 'MagnifyingGlassPlusOutline',
        },
        {
          id: 'action__show_qrcode',
          onPress: ({
            network,
            account,
          }: {
            network: Network;
            account: Account;
          }) => {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.Receive,
              params: {
                screen: ReceiveTokenModalRoutes.ReceiveToken,
                params: {
                  address: account.address,
                  displayAddress: account.displayAddress,
                  wallet,
                  network,
                  account,
                  template: account.template,
                },
              },
            });
          },
          icon: 'QrCodeOutline',
        },
      ].map((d) => ({
        ...d,
        onPress: () => {
          allNetworksSelectAccount(params).then((res) => {
            if (res) {
              d.onPress?.(res);
            }
          });
        },
      })),
    [navigation, wallet],
  );

  const renderItem: ListRenderItem<DataListItem> = useCallback(
    ({ item: { networkId, accounts } }) => {
      const network = allNetworks.find((n) => n.id === networkId);
      if (!network) {
        return null;
      }
      return (
        <HStack key={networkId} mb="4">
          <Token
            showInfo
            flex="1"
            size={8}
            token={{
              name: network?.name,
              symbol:
                accounts.length > 1
                  ? intl.formatMessage(
                      { id: 'form__str_addresses' },
                      {
                        0: accounts.length,
                      },
                    )
                  : shortenAddress(accounts[0].address),
              logoURI: network?.logoURI,
            }}
          />
          <IconButton
            name="Square2StackOutline"
            iconSize={20}
            type="plain"
            onPress={() => onCopyAddress({ networkId, accounts })}
          />
          <BaseMenu
            options={
              getMenus({
                networkId,
                accounts,
              }) as any[]
            }
          >
            <IconButton
              name="EllipsisVerticalMini"
              iconSize={20}
              type="plain"
            />
          </BaseMenu>
        </HStack>
      );
    },
    [allNetworks, intl, onCopyAddress, getMenus],
  );

  const toAllSupportedNetworksPage = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManageNetwork,
      params: {
        screen: ManageNetworkModalRoutes.AllNetworksSupportedNetworks,
      },
    });
  }, [navigation]);

  const footer = useMemo(
    () => (
      <>
        <Divider />
        <Pressable onPress={toAllSupportedNetworksPage} my="4">
          <HStack alignItems="center" justifyContent="center">
            <Typography.Body2 mr="4" color="text-subdued">
              {intl.formatMessage(
                { id: 'title__str_supported_networks' },
                {
                  0: allNetworks.filter((n) => !n.isTestnet).length,
                },
              )}
            </Typography.Body2>
            <Icon
              name="QuestionMarkCircleOutline"
              size={20}
              color="icon-subdued"
            />
          </HStack>
        </Pressable>
      </>
    ),
    [intl, allNetworks, toAllSupportedNetworksPage],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__included_networks' })}
      footer={footer}
      height="560px"
    >
      <List
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => (item as { networkId: string }).networkId}
        paddingX="2"
        ListEmptyComponent={<AllNetworksEmpty />}
      />
    </Modal>
  );
};
