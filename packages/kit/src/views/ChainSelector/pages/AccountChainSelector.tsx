import { useCallback, useEffect } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EChainSelectorPages,
  type IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { EditableChainSelector } from '../components/EditableChainSelector';
import { PureChainSelector } from '../components/PureChainSelector';

const defaultChainSelectorNetworks: {
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  unavailableItems: IServerNetwork[];
  frequentlyUsedItems: IServerNetwork[];
  allNetworkItem?: IServerNetwork;
} = {
  mainnetItems: [],
  testnetItems: [],
  unavailableItems: [],
  frequentlyUsedItems: [],
};

type IChainSelectorBaseProps = {
  sceneName: EAccountSelectorSceneName;
  num: number;
  networkIds?: string[];
  editable?: boolean;
  recordNetworkHistoryEnabled?: boolean;
  recentNetworksEnabled?: boolean;
};

type IAccountChainSelectorProps = IChainSelectorBaseProps & {
  onPressItem: (item: IServerNetwork) => void;
  onAddCustomNetwork?: () => void;
  onEditCustomNetwork?: ({
    network,
    refreshNetworkData,
  }: {
    network: IServerNetwork;
    refreshNetworkData: () => void;
  }) => void;
};

const EditableAccountChainSelector = ({
  num,
  networkIds,
  onPressItem,
  onAddCustomNetwork,
  onEditCustomNetwork,
}: IAccountChainSelectorProps) => {
  const {
    activeAccount: { network, account, wallet, indexedAccount },
  } = useActiveAccount({ num });
  const {
    result: {
      chainSelectorNetworks,
      accountNetworkValues,
      accountNetworkValueCurrency,
      accountDeFiOverview,
    },
    run: refreshLocalData,
  } = usePromiseResult(
    async () => {
      const [_accountsValue, _chainSelectorNetworks, _localDeFiOverview] =
        await Promise.all([
          backgroundApiProxy.serviceAccountProfile.getAllNetworkAccountsValue({
            accounts: [{ accountId: indexedAccount?.id ?? account?.id ?? '' }],
          }),
          backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
            {
              accountId: account?.id,
              walletId: wallet?.id,
              networkIds,
              useDefaultPinnedNetworks: true,
            },
          ),
          backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
            accounts: [
              {
                accountId: indexedAccount?.id ?? account?.id ?? '',
                accountAddress: account?.address,
                networkId: network?.id ?? '',
                indexedAccountId: indexedAccount?.id,
              },
            ],
          }),
        ]);

      if (_accountsValue[0] || _localDeFiOverview[0]) {
        const {
          chainSelectorNetworks: sortedChainSelectorNetworks,
          formattedAccountNetworkValues,
          accountDeFiOverview: _accountDeFiOverview,
        } = await backgroundApiProxy.serviceNetwork.sortChainSelectorNetworksByValue(
          {
            walletId: accountUtils.getWalletIdFromAccountId({
              accountId: _accountsValue[0].accountId,
            }),
            chainSelectorNetworks: _chainSelectorNetworks,
            accountNetworkValues: _accountsValue[0].value ?? {},
            localDeFiOverview: _localDeFiOverview[0]?.overview ?? {},
          },
        );

        return {
          chainSelectorNetworks: sortedChainSelectorNetworks,
          accountNetworkValues: formattedAccountNetworkValues,
          accountNetworkValueCurrency: _accountsValue[0].currency,
          accountDeFiOverview: _accountDeFiOverview,
        };
      }

      return {
        chainSelectorNetworks: _chainSelectorNetworks,
        accountNetworkValues: {},
        accountDeFiOverview: {},
      };
    },

    [
      account?.id,
      networkIds,
      wallet?.id,
      indexedAccount?.id,
      account?.address,
      network?.id,
    ],
    {
      initResult: {
        chainSelectorNetworks: defaultChainSelectorNetworks,
        accountNetworkValues: {},
        accountDeFiOverview: {},
      },
    },
  );

  useEffect(() => {
    const fn = async () => {
      await refreshLocalData();
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, fn);
    };
  }, [refreshLocalData]);

  return (
    <EditableChainSelector
      walletId={wallet?.id}
      networkId={network?.id}
      accountId={account?.id}
      indexedAccountId={indexedAccount?.id}
      mainnetItems={chainSelectorNetworks.mainnetItems}
      testnetItems={chainSelectorNetworks.testnetItems}
      unavailableItems={chainSelectorNetworks.unavailableItems}
      frequentlyUsedItems={chainSelectorNetworks.frequentlyUsedItems}
      allNetworkItem={chainSelectorNetworks.allNetworkItem}
      accountDeFiOverview={accountDeFiOverview}
      accountNetworkValues={accountNetworkValues}
      accountNetworkValueCurrency={accountNetworkValueCurrency}
      onPressItem={onPressItem}
      onAddCustomNetwork={onAddCustomNetwork}
      onEditCustomNetwork={(item: IServerNetwork) =>
        onEditCustomNetwork?.({
          network: item,
          refreshNetworkData: refreshLocalData,
        })
      }
      onFrequentlyUsedItemsChange={async (items) => {
        const pinnedNetworkIds =
          await backgroundApiProxy.serviceNetwork.getNetworkSelectorPinnedNetworkIds();
        const frequentlyUsedNetworkIds =
          chainSelectorNetworks.frequentlyUsedItems.map((o) => o.id);
        // If all pinned networks are involved in editing, just set
        if (pinnedNetworkIds.length === frequentlyUsedNetworkIds.length) {
          await backgroundApiProxy.serviceNetwork.setNetworkSelectorPinnedNetworkIds(
            {
              networkIds: items.map((o) => o.id),
            },
          );
        } else {
          /*
          If only some of the pinned networks participate in editing (filtered by unavailableItems). 
          Elements that do not participate in editing maintain their position. 
          Only elements that participate in editing are added, deleted, or modified.
          */
          const inputs = items.map((o) => o.id);

          const itemsToAdd: string[] = [];

          const itemsToRemove: string[] = frequentlyUsedNetworkIds.filter(
            (o) => !inputs.includes(o),
          );

          let newPinnedNetworkIds = [...pinnedNetworkIds];

          // networkId to index at pinnedNetworkIds
          const networkIdsIndexes = pinnedNetworkIds.reduce(
            (acc, item, index) => {
              acc[item] = index;
              return acc;
            },
            {} as Record<string, number>,
          );

          const frequentlyUsedIndexes: number[] = frequentlyUsedNetworkIds.map(
            (o) => networkIdsIndexes[o],
          );

          const len = Math.max(frequentlyUsedIndexes.length, inputs.length);

          for (let i = 0; i < len; i += 1) {
            const input = inputs[i];
            const inputIndex = frequentlyUsedIndexes[i];

            if (input && inputIndex !== undefined) {
              // inputIndex is the position in pinned networks, do replace
              newPinnedNetworkIds[inputIndex] = input;
            } else if (input && inputIndex === undefined) {
              // do added
              itemsToAdd.push(input);
            }
          }

          if (itemsToAdd.length) {
            const indexToAdd =
              frequentlyUsedIndexes[frequentlyUsedIndexes.length - 1];
            if (indexToAdd !== undefined) {
              newPinnedNetworkIds.splice(indexToAdd + 1, 0, ...itemsToAdd);
            } else {
              newPinnedNetworkIds.push(...itemsToAdd);
            }
          }
          if (itemsToRemove.length) {
            newPinnedNetworkIds = newPinnedNetworkIds.filter(
              (o) => !itemsToRemove.includes(o),
            );
          }
          await backgroundApiProxy.serviceNetwork.setNetworkSelectorPinnedNetworkIds(
            {
              networkIds: newPinnedNetworkIds,
            },
          );
        }

        await refreshLocalData();
      }}
    />
  );
};

const NotEditableAccountChainSelector = ({
  num,
  networkIds,
  onPressItem,
}: IAccountChainSelectorProps) => {
  const {
    activeAccount: { network },
  } = useActiveAccount({ num });
  const { result, run: refreshLocalData } = usePromiseResult(async () => {
    let networks: IServerNetwork[] = [];
    if (networkIds && networkIds.length > 0) {
      const resp = await backgroundApiProxy.serviceNetwork.getNetworksByIds({
        networkIds,
      });
      networks = resp.networks;
    } else {
      const resp = await backgroundApiProxy.serviceNetwork.getAllNetworks();
      networks = resp.networks;
    }
    return networks;
  }, [networkIds]);

  useEffect(() => {
    const fn = async () => {
      await refreshLocalData();
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, fn);
    };
  }, [refreshLocalData]);

  return (
    <PureChainSelector
      networkId={network?.id}
      networks={result ?? []}
      onPressItem={onPressItem}
    />
  );
};

function AccountChainSelector({
  sceneName,
  num,
  networkIds,
  editable,
  recordNetworkHistoryEnabled,
}: IChainSelectorBaseProps) {
  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const {
    activeAccount: { network: activeNetwork },
  } = useActiveAccount({ num });
  const handleListItemPress = useCallback(
    (item: IServerNetwork) => {
      if (
        sceneName === EAccountSelectorSceneName.home ||
        sceneName === EAccountSelectorSceneName.homeUrlAccount
      ) {
        defaultLogger.wallet.walletActions.switchNetwork({
          networkName: item.name,
          details: {
            isCustomNetwork: !!item.isCustomNetwork,
          },
        });
      }

      if (recordNetworkHistoryEnabled && activeNetwork) {
        void backgroundApiProxy.serviceNetwork.updateRecentNetwork({
          networkId: activeNetwork.id,
        });
      }

      void actions.current.updateSelectedAccountNetwork({
        num,
        networkId: item.id,
      });

      navigation.popStack();
    },
    [
      actions,
      num,
      navigation,
      recordNetworkHistoryEnabled,
      activeNetwork,
      sceneName,
    ],
  );
  const onAddCustomNetwork = useCallback(() => {
    navigation.push(EChainSelectorPages.AddCustomNetwork, {
      state: 'add',
      onSuccess: (network: IServerNetwork) => {
        handleListItemPress(network);
      },
    });
  }, [navigation, handleListItemPress]);
  const onEditCustomNetwork = useCallback(
    async ({
      network,
      refreshNetworkData,
    }: {
      network: IServerNetwork;
      refreshNetworkData: () => void;
    }) => {
      const rpcInfo =
        await backgroundApiProxy.serviceCustomRpc.getCustomRpcForNetwork(
          network.id,
        );
      navigation.push(EChainSelectorPages.AddCustomNetwork, {
        state: 'edit',
        networkId: network.id,
        networkName: network.name,
        rpcUrl: rpcInfo?.rpc ?? '',
        chainId: network.chainId,
        symbol: network.symbol,
        blockExplorerUrl: network.explorerURL,
        onSuccess: () => refreshNetworkData(),
        onDeleteSuccess: () => {
          navigation.pop();
        },
      });
    },
    [navigation],
  );
  return editable ? (
    <EditableAccountChainSelector
      onPressItem={handleListItemPress}
      onAddCustomNetwork={onAddCustomNetwork}
      onEditCustomNetwork={onEditCustomNetwork}
      num={num}
      networkIds={networkIds}
      sceneName={sceneName}
    />
  ) : (
    <NotEditableAccountChainSelector
      onPressItem={handleListItemPress}
      num={num}
      networkIds={networkIds}
      sceneName={sceneName}
    />
  );
}

export default function ChainSelectorPage({
  route,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.AccountChainSelector
>) {
  const {
    num,
    sceneName,
    sceneUrl,
    networkIds,
    editable,
    recordNetworkHistoryEnabled,
    recentNetworksEnabled,
  } = route.params;

  return (
    <AccountSelectorProviderMirror
      enabledNum={[num]}
      config={{
        sceneName,
        sceneUrl,
      }}
    >
      <AccountChainSelector
        num={num}
        networkIds={networkIds}
        editable={editable}
        recordNetworkHistoryEnabled={recordNetworkHistoryEnabled}
        recentNetworksEnabled={recentNetworksEnabled}
        sceneName={sceneName}
      />
    </AccountSelectorProviderMirror>
  );
}
