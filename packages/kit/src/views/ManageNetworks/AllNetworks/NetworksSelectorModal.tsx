import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Badge, HStack, Modal, Pressable, Token } from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';

import { useManageNetworks } from '../../../hooks';
import { useAllNetworksWalletAccounts } from '../../../hooks/useAllNetwoks';
import { showAllNetworksAccountDerivationsSelector } from '../../Overlay/Accounts/AllNetworksSelectAccountDerivations';

import type {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '../types';
import type { RouteProp } from '@react-navigation/core';
import type { ListRenderItem } from 'react-native';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.AllNetworksNetworkSelector
>;

function AllNetworksNetworkSelectorModal() {
  const intl = useIntl();
  const closeModal = useModalClose();
  const route = useRoute<RouteProps>();

  const { allNetworks } = useManageNetworks();

  const { walletId, accountId, filter, onConfirm } = route?.params ?? {};

  const networkAccounts = useAllNetworksWalletAccounts({
    accountId,
    walletId,
  });

  const handlePress = useCallback(
    ({ network, accounts }: { network: Network; accounts: Account[] }) => {
      if (accounts.length <= 1) {
        onConfirm?.({
          network,
          account: accounts[0],
        });
        closeModal?.();
      } else {
        showAllNetworksAccountDerivationsSelector({
          network,
          accounts,
          onConfirm: (account) => {
            onConfirm?.({
              network,
              account,
            });
            closeModal?.();
          },
        });
      }
    },
    [closeModal, onConfirm],
  );

  const renderItem: ListRenderItem<Network> = useCallback(
    ({ item, index }) => {
      let accounts = networkAccounts[item.id] ?? [];
      if (typeof filter === 'function') {
        if (accounts.length) {
          accounts = (networkAccounts[item.id] ?? []).filter((a) =>
            filter({ network: item, account: a }),
          );
          if (!accounts.length) return null;
        }
        if (!filter({ network: item, account: accounts[0] })) return null;
      }
      return (
        <Pressable
          onPress={() => {
            handlePress({
              network: item,
              accounts,
            });
          }}
        >
          <HStack px="4" py="3" pt={index === 0 ? 0 : 3}>
            <Token
              size="8"
              token={{ name: item.shortName, logoURI: item.logoURI }}
              showInfo
            />
            {accounts.length > 1 ? (
              <Badge
                type="default"
                size="sm"
                ml="3"
                title={intl.formatMessage(
                  { id: 'form__str_addresses' },
                  {
                    0: accounts.length,
                  },
                )}
              />
            ) : null}
          </HStack>
        </Pressable>
      );
    },
    [intl, networkAccounts, filter, handlePress],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__select_network' })}
      footer={null}
      height="560px"
      style={{ padding: 0 }}
      flatListProps={{
        style: { padding: 0 },
        data: allNetworks,
        // eslint-disable-next-line
        // @ts-ignore
        renderItem,
        keyExtractor: (item) => (item as Network).id,
        showsVerticalScrollIndicator: false,
      }}
    />
  );
}

export { AllNetworksNetworkSelectorModal };
