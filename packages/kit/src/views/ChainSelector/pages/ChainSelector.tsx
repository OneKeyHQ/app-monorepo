import { useState } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Button, Page } from '@onekeyhq/components';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useAccountSelectorAvailableNetworks } from '../../../components/AccountSelector/hooks/useAccountSelectorAvailableNetworks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useActiveAccount,
} from '../../../states/jotai/contexts/accountSelector';
import { ListNetworkView } from '../components/ListNetworkView';

function getHeaderRightComponent(
  isEditMode: boolean,
  handleEditButtonPress: () => void,
) {
  return (
    <Button variant="tertiary" onPress={handleEditButtonPress}>
      {isEditMode ? 'Done' : 'Edit'}
    </Button>
  );
}

function ChainSelector({ num }: { num: number }) {
  const {
    activeAccount: { network },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();
  const selectedChain = network?.id;
  const [isEditMode, setIsEditMode] = useState(false);
  const { serviceNetwork } = backgroundApiProxy;

  const { networkIds } = useAccountSelectorAvailableNetworks({ num });

  const {
    result: [{ networks }, pinnedNetworks],
    run: refreshLocalData,
  } = usePromiseResult(
    () => {
      const networksData = serviceNetwork.getNetworksByIds({
        networkIds: networkIds || [],
      });
      const pinnedNetworksData = serviceNetwork.getPinnedNetworks();
      return Promise.all([networksData, pinnedNetworksData]);
    },
    [networkIds, serviceNetwork],
    {
      initResult: [
        {
          networks: [],
        },
        [],
      ],
    },
  );

  const handleListItemPress = (networkId: string) => {
    void actions.current.updateSelectedAccountNetwork({
      num,
      networkId,
    });
    navigation.popStack();
  };

  const handleEditButtonPress = () => {
    setIsEditMode(!isEditMode);
  };
  const [searchText, setSearchText] = useState('');

  return (
    <Page>
      <Page.Header
        title="Networks"
        headerRight={() =>
          getHeaderRightComponent(isEditMode, handleEditButtonPress)
        }
        headerSearchBarOptions={{
          placeholder: 'Search',
          onChangeText: (e) => setSearchText(e.nativeEvent.text),
        }}
      />
      <Page.Body>
        <ListNetworkView
          searchText={searchText.trim()}
          isEditMode={isEditMode}
          topNetworks={pinnedNetworks}
          allNetworks={networks}
          selectNetworkId={selectedChain}
          onChangeTopNetworks={async (items) => {
            await backgroundApiProxy.serviceNetwork.setPinnedNetworks(items);
            await refreshLocalData();
          }}
          onPressItem={(item) => handleListItemPress(item.id)}
        />
      </Page.Body>
    </Page>
  );
}

export default function ChainSelectorPage({
  route,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.ChainSelector
>) {
  const { num, sceneName, sceneUrl } = route.params;
  return (
    <AccountSelectorProviderMirror
      enabledNum={[num]}
      config={{
        sceneName,
        sceneUrl,
      }}
    >
      <ChainSelector num={num} />
    </AccountSelectorProviderMirror>
  );
}
