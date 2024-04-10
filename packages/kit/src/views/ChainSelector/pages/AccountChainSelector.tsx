import type { IPageScreenProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
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
    activeAccount: { network },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  const {
    result: [{ networks }, pinnedNetworks],
    run: refreshLocalData,
  } = usePromiseResult(
    () => {
      let networkPromise: Promise<{ networks: IServerNetwork[] }>;
      if (networkIds && networkIds.length > 0) {
        networkPromise = backgroundApiProxy.serviceNetwork.getNetworksByIds({
          networkIds: networkIds || [],
        });
      } else {
        networkPromise = backgroundApiProxy.serviceNetwork.getAllNetworks();
      }
      const pinnedNetworksData =
        backgroundApiProxy.serviceNetwork.getNetworkSelectorPinnedNetworks();
      return Promise.all([networkPromise, pinnedNetworksData]);
    },
    [networkIds],
    {
      initResult: [
        {
          networks: [],
        },
        [],
      ],
    },
  );

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
      networks={networks}
      networkId={network?.id}
      onPressItem={handleListItemPress}
      defaultTopNetworks={pinnedNetworks}
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
