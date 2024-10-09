import { useCallback } from 'react';

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
  EChainSelectorPages,
  type IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import type { IServerNetwork } from '@onekeyhq/shared/types';

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
  num: number;
  networkIds?: string[];
  editable?: boolean;
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
    activeAccount: { network, account, wallet },
  } = useActiveAccount({ num });
  const { result: chainSelectorNetworks, run: refreshLocalData } =
    usePromiseResult(
      async () =>
        backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          {
            accountId: account?.id,
            walletId: wallet?.id,
            networkIds,
          },
        ),
      [account?.id, networkIds, wallet?.id],
      { initResult: defaultChainSelectorNetworks },
    );

  return (
    <EditableChainSelector
      networkId={network?.id}
      mainnetItems={chainSelectorNetworks.mainnetItems}
      testnetItems={chainSelectorNetworks.testnetItems}
      unavailableItems={chainSelectorNetworks.unavailableItems}
      frequentlyUsedItems={chainSelectorNetworks.frequentlyUsedItems}
      allNetworkItem={chainSelectorNetworks.allNetworkItem}
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
  const { result } = usePromiseResult(async () => {
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
  return (
    <PureChainSelector
      networkId={network?.id}
      networks={result ?? []}
      onPressItem={onPressItem}
    />
  );
};

function AccountChainSelector({
  num,
  networkIds,
  editable,
}: IChainSelectorBaseProps) {
  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const handleListItemPress = useCallback(
    (item: IServerNetwork) => {
      void actions.current.updateSelectedAccountNetwork({
        num,
        networkId: item.id,
      });
      navigation.popStack();
    },
    [actions, num, navigation],
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
    />
  ) : (
    <NotEditableAccountChainSelector
      onPressItem={handleListItemPress}
      num={num}
      networkIds={networkIds}
    />
  );
}

export default function ChainSelectorPage({
  route,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.AccountChainSelector
>) {
  const { num, sceneName, sceneUrl, networkIds, editable } = route.params;

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
      />
    </AccountSelectorProviderMirror>
  );
}
