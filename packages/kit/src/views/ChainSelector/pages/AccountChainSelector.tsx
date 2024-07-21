import { useMemo } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { ChainSelectorPageView } from '../components/PageView';

function ChainSelector({
  num,
  networkIds,
  editable,
}: {
  num: number;
  networkIds?: string[];
  editable?: boolean;
}) {
  const {
    activeAccount: { network, account, isOthersWallet },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  const { result, run: refreshLocalData } = usePromiseResult(
    () => {
      let _networks: Promise<{ networks: IServerNetwork[] }>;
      if (networkIds && networkIds.length > 0) {
        _networks = backgroundApiProxy.serviceNetwork.getNetworksByIds({
          networkIds: networkIds || [],
        });
      } else {
        _networks = backgroundApiProxy.serviceNetwork.getAllNetworks();
      }
      const _pinnedNetworks =
        backgroundApiProxy.serviceNetwork.getNetworkSelectorPinnedNetworks();
      const _allNetwork = backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: getNetworkIdsMap().all,
      });
      return Promise.all([_networks, _pinnedNetworks, _allNetwork]);
    },
    [networkIds],
    {
      initResult: [
        {
          networks: [],
        },
        [],
        undefined,
      ],
    },
  );

  const data = useMemo(() => {
    let [{ networks: _networks }, _pinnedNetworks, _allNetwork] = result;
    _networks = _networks.filter((o) => o.id !== getNetworkIdsMap().all);
    let unavailableNetworks: IServerNetwork[] = [];
    let pinnedNetworks: IServerNetwork[] = [];
    let networks: IServerNetwork[] = [];
    if (account && isOthersWallet) {
      for (let i = 0; i < _pinnedNetworks.length; i += 1) {
        const item = _pinnedNetworks[i];
        if (
          accountUtils.isAccountCompatibleWithNetwork({
            account,
            networkId: item.id,
          })
        ) {
          pinnedNetworks.push(item);
        } else {
          unavailableNetworks.push(item);
        }
      }
      for (let i = 0; i < _networks.length; i += 1) {
        const item = _networks[i];
        if (
          accountUtils.isAccountCompatibleWithNetwork({
            account,
            networkId: item.id,
          })
        ) {
          networks.push(item);
        } else {
          unavailableNetworks.push(item);
        }
      }
    } else {
      pinnedNetworks = [..._pinnedNetworks];
      networks = [..._networks];
    }
    const unavailableNetworkIds: Set<string> = new Set<string>();
    unavailableNetworks = unavailableNetworks.filter((o) => {
      const hasContain = unavailableNetworkIds.has(o.id);
      if (!hasContain) {
        unavailableNetworkIds.add(o.id);
      }
      return !hasContain;
    });
    return {
      defaultTopNetworks: _allNetwork
        ? [_allNetwork, ...pinnedNetworks]
        : pinnedNetworks,
      networks,
      unavailableNetworks,
    };
  }, [result, account, isOthersWallet]);

  const handleListItemPress = (item: IServerNetwork) => {
    void actions.current.updateSelectedAccountNetwork({
      num,
      networkId: item.id,
    });
    navigation.popStack();
  };

  return (
    <ChainSelectorPageView
      editable={editable}
      networkId={network?.id}
      networks={data.networks}
      unavailableNetworks={data.unavailableNetworks}
      defaultTopNetworks={data.defaultTopNetworks}
      onPressItem={handleListItemPress}
      onTopNetworksChange={async (items) => {
        await backgroundApiProxy.serviceNetwork.setNetworkSelectorPinnedNetworks(
          {
            networks: items,
          },
        );
        await refreshLocalData();
      }}
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
      <ChainSelector num={num} editable={editable} networkIds={networkIds} />
    </AccountSelectorProviderMirror>
  );
}
