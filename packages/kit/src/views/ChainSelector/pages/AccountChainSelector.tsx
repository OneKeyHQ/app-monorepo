import { useCallback, useEffect } from 'react';

import { resetChainSelectorModal } from '@onekeyhq/components';
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
          backgroundApiProxy.serviceAccountProfile.getAllNetworkAccountsValueByAccountId(
            { accountId: indexedAccount?.id ?? account?.id ?? '' },
          ),
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

      if (_accountsValue || _localDeFiOverview[0]) {
        const {
          chainSelectorNetworks: sortedChainSelectorNetworks,
          formattedAccountNetworkValues,
          accountDeFiOverview: _accountDeFiOverview,
        } = await backgroundApiProxy.serviceNetwork.sortChainSelectorNetworksByValue(
          {
            walletId: accountUtils.getWalletIdFromAccountId({
              accountId: _accountsValue?.accountId ?? '',
            }),
            chainSelectorNetworks: _chainSelectorNetworks,
            accountNetworkValues: _accountsValue?.value ?? {},
            localDeFiOverview: _localDeFiOverview[0]?.overview ?? {},
          },
        );

        return {
          chainSelectorNetworks: sortedChainSelectorNetworks,
          accountNetworkValues: formattedAccountNetworkValues,
          accountNetworkValueCurrency: _accountsValue?.currency,
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
      showAllNetworkInRecentNetworks
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

      // Surgically drop only the ChainSelectorModal route. popStack() triggers
      // a native animated dismiss that leaves tab RNSScreenStacks with window=NIL
      // (~5s retry storm on iOS). resetAboveMainRoute would also kill any parent
      // modal (DApp connect, Settings, BulkSend, Onboarding) that pushed us here,
      // so filter by route name instead. See ios-overlay-navigation-freeze.md.
      resetChainSelectorModal();
    },
    [actions, num, recordNetworkHistoryEnabled, activeNetwork, sceneName],
  );
  const onAddCustomNetwork = useCallback(() => {
    navigation.push(EChainSelectorPages.ChainListSearch, {
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
