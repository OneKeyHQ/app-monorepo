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
};

const EditableAccountChainSelector = ({
  num,
  networkIds,
  onPressItem,
}: IAccountChainSelectorProps) => {
  const {
    activeAccount: { network, dbAccount },
  } = useActiveAccount({ num });
  const { result: chainSelectorNetworks, run: refreshLocalData } =
    usePromiseResult(
      async () =>
        backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
          { accountId: dbAccount?.id, networkIds },
        ),
      [dbAccount?.id, networkIds],
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
      onFrequentlyUsedItemsChange={async (items) => {
        await backgroundApiProxy.serviceNetwork.setNetworkSelectorPinnedNetworks(
          {
            networks: items,
          },
        );
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
  const handleListItemPress = (item: IServerNetwork) => {
    void actions.current.updateSelectedAccountNetwork({
      num,
      networkId: item.id,
    });
    navigation.popStack();
  };
  return editable ? (
    <EditableAccountChainSelector
      onPressItem={handleListItemPress}
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
