import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Badge, List, ListItem, Modal, Token } from '@onekeyhq/components';
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

  const { enabledNetworks } = useManageNetworks();

  const supportedNetworks = useMemo(
    () =>
      enabledNetworks.filter(
        (n) =>
          !n.isTestnet &&
          !n.settings?.validationRequired &&
          !n.settings.hideInAllNetworksMode,
      ),
    [enabledNetworks],
  );

  const { filter, onConfirm, accountId } = route?.params ?? {};

  const { data: networkAccounts } = useAllNetworksWalletAccounts({
    accountId,
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
    ({ item }) => {
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
        <ListItem
          flex="1"
          onPress={() => {
            handlePress({
              network: item,
              accounts,
            });
          }}
        >
          <ListItem.Column>
            <Token
              size={8}
              token={{
                logoURI: item.logoURI,
              }}
            />
          </ListItem.Column>
          <ListItem.Column
            text={{
              label: item.name,
            }}
          />
          <ListItem.Column>
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
          </ListItem.Column>
        </ListItem>
      );
    },
    [intl, networkAccounts, filter, handlePress],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__select_network' })}
      footer={null}
      height="560px"
    >
      <List
        data={supportedNetworks}
        contentContainerStyle={{
          flex: supportedNetworks?.length ? undefined : 1,
        }}
        renderItem={renderItem}
        keyExtractor={(item: Network) => item.id}
      />
    </Modal>
  );
}

export { AllNetworksNetworkSelectorModal };
