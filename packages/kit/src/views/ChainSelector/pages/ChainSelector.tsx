import type { FC } from 'react';
import { useState } from 'react';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Button, Page } from '@onekeyhq/components';
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

import { EditableView } from '../components/EditableView';
import { ImmutableView } from '../components/ImmutableView';

type IChainSelectorViewProps = {
  networks: IServerNetwork[];
  defaultNetworkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
};

type IChainSelectorEditableViewProps = IChainSelectorViewProps & {
  defaultTopNetworks: IServerNetwork[];
  onTopNetworksChange?: (networks: IServerNetwork[]) => void;
};

const ChainSelectorImmutableView: FC<IChainSelectorViewProps> = ({
  networks,
  defaultNetworkId,
  onPressItem,
}) => (
  <Page>
    <Page.Header title="Network" />
    <Page.Body>
      <ImmutableView
        defaultNetworkId={defaultNetworkId}
        networks={networks}
        onPressItem={onPressItem}
      />
    </Page.Body>
  </Page>
);

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

const ChainSelectorEditableView: FC<IChainSelectorEditableViewProps> = ({
  networks,
  defaultNetworkId,
  onPressItem,
  defaultTopNetworks,
  onTopNetworksChange,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const handleEditButtonPress = () => {
    setIsEditMode(!isEditMode);
  };
  return (
    <Page>
      <Page.Header
        title="Network"
        headerRight={() =>
          getHeaderRightComponent(isEditMode, handleEditButtonPress)
        }
      />
      <Page.Body>
        <EditableView
          isEditMode={isEditMode}
          defaultTopNetworks={defaultTopNetworks}
          defaultNetworkId={defaultNetworkId}
          allNetworks={networks}
          onPressItem={onPressItem}
          onTopNetworksChange={onTopNetworksChange}
        />
      </Page.Body>
    </Page>
  );
};

function ChainSelector({
  num,
  networkIds,
  defaultNetworkId,
  immutable,
}: {
  num: number;
  networkIds?: string[];
  defaultNetworkId?: string;
  immutable?: boolean;
}) {
  const {
    activeAccount: { network },
  } = useActiveAccount({ num });
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();
  const selectedNetworkId = defaultNetworkId ?? network?.id;

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
        backgroundApiProxy.serviceNetwork.getPinnedNetworks();
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

  return immutable ? (
    <ChainSelectorImmutableView
      networks={networks}
      defaultNetworkId={selectedNetworkId}
      onPressItem={handleListItemPress}
    />
  ) : (
    <ChainSelectorEditableView
      networks={networks}
      defaultNetworkId={selectedNetworkId}
      onPressItem={handleListItemPress}
      defaultTopNetworks={pinnedNetworks}
      onTopNetworksChange={async (items) => {
        await backgroundApiProxy.serviceNetwork.setPinnedNetworks({
          networks: items,
        });
        await refreshLocalData();
      }}
    />
  );
}

export default function ChainSelectorPage({
  route,
}: IPageScreenProps<
  IChainSelectorParamList,
  EChainSelectorPages.ChainSelector
>) {
  const { num, sceneName, sceneUrl, networkIds, defaultNetworkId, immutable } =
    route.params;
  return (
    <AccountSelectorProviderMirror
      enabledNum={[num]}
      config={{
        sceneName,
        sceneUrl,
      }}
    >
      <ChainSelector
        num={num}
        immutable={immutable}
        networkIds={networkIds}
        defaultNetworkId={defaultNetworkId}
      />
    </AccountSelectorProviderMirror>
  );
}
