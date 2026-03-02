import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { EditableChainSelectorContent } from '../EditableChainSelector/ChainSelectorContent';

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

type INetworkContentProps = {
  walletId?: string;
  accountId?: string;
  indexedAccountId?: string;
  networkId?: string;
  networkIds?: string[];
  onPressItem?: (network: IServerNetwork) => void;
  onAddCustomNetwork?: () => void;
  onEditCustomNetwork?: (network: IServerNetwork) => void;
  onFrequentlyUsedItemsChange?: (networks: IServerNetwork[]) => void;
  searchText?: string;
  setSearchText?: Dispatch<SetStateAction<string>>;
  accountAddress?: string;
};

export function NetworkContent({
  walletId,
  accountId,
  indexedAccountId,
  networkId,
  networkIds,
  onPressItem,
  onAddCustomNetwork,
  onEditCustomNetwork,
  onFrequentlyUsedItemsChange,
  searchText,
  setSearchText,
}: INetworkContentProps) {
  const {
    result: {
      chainSelectorNetworks,
      accountNetworkValues,
      accountNetworkValueCurrency,
      accountDeFiOverview,
      zeroValue,
    },
    run: refreshLocalData,
  } = usePromiseResult(
    async () => {
      const [_accountsValue, _chainSelectorNetworks, _localDeFiOverview] =
        await Promise.all([
          backgroundApiProxy.serviceAccountProfile.getAllNetworkAccountsValue({
            accounts: [{ accountId: indexedAccountId ?? accountId ?? '' }],
          }),
          backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
            {
              accountId,
              walletId,
              networkIds,
              useDefaultPinnedNetworks: true,
            },
          ),
          backgroundApiProxy.serviceDeFi.getAccountsLocalDeFiOverview({
            accounts: [
              {
                accountId: indexedAccountId ?? accountId ?? '',
                networkId: getNetworkIdsMap().onekeyall,
                indexedAccountId,
              },
            ],
            networksEnabledOnly: false,
          }),
        ]);

      if (_accountsValue[0] || _localDeFiOverview[0]) {
        const {
          chainSelectorNetworks: sortedChainSelectorNetworks,
          formattedAccountNetworkValues,
          accountDeFiOverview: _accountDeFiOverview,
          // eslint-disable-next-line @typescript-eslint/no-shadow
          zeroValue,
        } = await backgroundApiProxy.serviceNetwork.sortChainSelectorNetworksByValue(
          {
            walletId: accountUtils.getWalletIdFromAccountId({
              accountId: _accountsValue[0]?.accountId ?? '',
            }),
            chainSelectorNetworks: _chainSelectorNetworks,
            accountNetworkValues: _accountsValue[0]?.value ?? {},
            localDeFiOverview: _localDeFiOverview[0]?.overview ?? {},
          },
        );

        return {
          chainSelectorNetworks: sortedChainSelectorNetworks,
          accountNetworkValues: formattedAccountNetworkValues,
          accountNetworkValueCurrency: _accountsValue[0]?.currency,
          accountDeFiOverview: _accountDeFiOverview,
          zeroValue,
        };
      }

      return {
        chainSelectorNetworks: _chainSelectorNetworks,
        accountNetworkValues: {},
        accountDeFiOverview: {},
        zeroValue: true,
      };
    },
    [accountId, networkIds, walletId, indexedAccountId],
    {
      initResult: {
        chainSelectorNetworks: defaultChainSelectorNetworks,
        accountNetworkValues: {},
        accountDeFiOverview: {},
        zeroValue: true,
      },
    },
  );

  useEffect(() => {
    const fn = async () => {
      try {
        // Use alwaysSetState to bypass the isFocused check, because this
        // event can fire while the navigation-back animation is still
        // running (screen not yet focused), which would silently skip
        // the refresh and leave stale data in the search list.
        await refreshLocalData({ alwaysSetState: true });
      } catch {
        // silently ignore refresh errors
      }
    };
    appEventBus.on(EAppEventBusNames.AddedCustomNetwork, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.AddedCustomNetwork, fn);
    };
  }, [refreshLocalData]);

  const handleFrequentlyUsedItemsChange = useCallback(
    async (items: IServerNetwork[]) => {
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
      onFrequentlyUsedItemsChange?.(items);
    },
    [
      chainSelectorNetworks.frequentlyUsedItems,
      refreshLocalData,
      onFrequentlyUsedItemsChange,
    ],
  );

  return (
    <EditableChainSelectorContent
      recentNetworksEnabled
      showAllNetworkInRecentNetworks
      walletId={walletId}
      networkId={networkId}
      accountId={accountId}
      indexedAccountId={indexedAccountId}
      zeroValue={zeroValue}
      mainnetItems={chainSelectorNetworks.mainnetItems}
      testnetItems={chainSelectorNetworks.testnetItems}
      unavailableItems={chainSelectorNetworks.unavailableItems}
      frequentlyUsedItems={chainSelectorNetworks.frequentlyUsedItems}
      accountDeFiOverview={accountDeFiOverview}
      accountNetworkValues={accountNetworkValues}
      accountNetworkValueCurrency={accountNetworkValueCurrency}
      onPressItem={onPressItem}
      onAddCustomNetwork={onAddCustomNetwork}
      onEditCustomNetwork={onEditCustomNetwork}
      onFrequentlyUsedItemsChange={handleFrequentlyUsedItemsChange}
      searchText={searchText}
      setSearchText={setSearchText}
    />
  );
}
