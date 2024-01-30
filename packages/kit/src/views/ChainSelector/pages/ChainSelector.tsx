import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Button, Page } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

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

import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '../router/type';

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
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();
  const selectedChain = network?.id;
  const [isEditMode, setIsEditMode] = useState(false);
  const { serviceNetwork } = backgroundApiProxy;

  const { networkIds } = useAccountSelectorAvailableNetworks({ num });

  const {
    result: { networks },
  } = usePromiseResult(
    () =>
      serviceNetwork.getNetworksByIds({
        networkIds: networkIds || [],
      }),
    [networkIds, serviceNetwork],
    {
      initResult: {
        networks: [],
      },
    },
  );

  const handleListItemPress = (networkId: string) => {
    actions.current.updateSelectedAccount({
      num,
      builder: (v) => ({
        ...v,
        networkId,
      }),
    });
    navigation.popStack();
  };

  const handleEditButtonPress = () => {
    setIsEditMode(!isEditMode);
  };

  const [topNetworks, setTopNetworks] = useState<IServerNetwork[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (networks.length) {
      setTopNetworks(networks.slice(0, 4));
    }
  }, [networks]);

  return (
    <Page>
      <Page.Header
        title="Select Chain"
        headerRight={() =>
          getHeaderRightComponent(isEditMode, handleEditButtonPress)
        }
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({ id: 'form__search' }),
          onChangeText: (e) => setSearchText(e.nativeEvent.text),
        }}
      />
      <Page.Body>
        <ListNetworkView
          searchText={searchText}
          isEditMode={isEditMode}
          topNetworks={topNetworks}
          allNetworks={networks}
          selectNetworkId={selectedChain}
          onChangeTopNetworks={setTopNetworks}
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
