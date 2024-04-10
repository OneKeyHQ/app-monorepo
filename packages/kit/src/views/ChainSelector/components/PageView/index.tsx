import type { FC } from 'react';
import { useState } from 'react';

import { Button, Page } from '@onekeyhq/components';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { EditableView } from '../EditableView';
import { ImmutableView } from '../ImmutableView';

type IChainSelectorViewProps = {
  title?: string;
  networks: IServerNetwork[];
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
};

type IChainSelectorEditableViewProps = IChainSelectorViewProps & {
  defaultTopNetworks?: IServerNetwork[];
  onTopNetworksChange?: (networks: IServerNetwork[]) => void;
};

type IChainSelectorPageViewProps = IChainSelectorEditableViewProps & {
  editable?: boolean;
};

const ChainSelectorImmutableView: FC<IChainSelectorViewProps> = ({
  title = 'Network',
  networks,
  networkId,
  onPressItem,
}) => (
  <Page>
    <Page.Header title={title} />
    <Page.Body>
      <ImmutableView
        networkId={networkId}
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
  networkId,
  onPressItem,
  defaultTopNetworks = [],
  onTopNetworksChange,
  title = 'Network',
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const handleEditButtonPress = () => {
    setIsEditMode(!isEditMode);
  };
  return (
    <Page>
      <Page.Header
        title={title}
        headerRight={() =>
          getHeaderRightComponent(isEditMode, handleEditButtonPress)
        }
      />
      <Page.Body>
        <EditableView
          isEditMode={isEditMode}
          defaultTopNetworks={defaultTopNetworks}
          networkId={networkId}
          allNetworks={networks}
          onPressItem={onPressItem}
          onTopNetworksChange={onTopNetworksChange}
        />
      </Page.Body>
    </Page>
  );
};

export const ChainSelectorPageView: FC<IChainSelectorPageViewProps> = ({
  editable,
  networks,
  networkId,
  defaultTopNetworks,
  onPressItem,
  onTopNetworksChange,
}) =>
  editable ? (
    <ChainSelectorEditableView
      networks={networks}
      networkId={networkId}
      defaultTopNetworks={defaultTopNetworks}
      onPressItem={onPressItem}
      onTopNetworksChange={onTopNetworksChange}
    />
  ) : (
    <ChainSelectorImmutableView
      networks={networks}
      networkId={networkId}
      onPressItem={onPressItem}
    />
  );
