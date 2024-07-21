import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  unavailableNetworks?: IServerNetwork[];
};

type IChainSelectorPageViewProps = IChainSelectorEditableViewProps & {
  editable?: boolean;
};

const ChainSelectorImmutableView: FC<IChainSelectorViewProps> = ({
  networks,
  networkId,
  onPressItem,
}) => {
  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_networks })}
      />
      <Page.Body>
        <ImmutableView
          networkId={networkId}
          networks={networks}
          onPressItem={onPressItem}
        />
      </Page.Body>
    </Page>
  );
};

function getHeaderRightComponent(
  label: string,
  handleEditButtonPress: () => void,
) {
  return (
    <Button variant="tertiary" onPress={handleEditButtonPress}>
      {label}
    </Button>
  );
}

const ChainSelectorEditableView: FC<IChainSelectorEditableViewProps> = ({
  networks,
  networkId,
  onPressItem,
  unavailableNetworks = [],
  defaultTopNetworks = [],
  onTopNetworksChange,
}) => {
  const intl = useIntl();
  const [isEditMode, setIsEditMode] = useState(false);

  const headerRight = useMemo(() => {
    if (unavailableNetworks.length > 0) {
      return undefined;
    }
    return () =>
      getHeaderRightComponent(
        isEditMode
          ? intl.formatMessage({ id: ETranslations.global_done })
          : intl.formatMessage({ id: ETranslations.global_edit }),
        () => setIsEditMode(!isEditMode),
      );
  }, [intl, isEditMode, unavailableNetworks]);
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_networks })}
        headerRight={headerRight}
      />
      <Page.Body>
        <EditableView
          isEditMode={isEditMode}
          defaultTopNetworks={defaultTopNetworks}
          unavailableNetworks={unavailableNetworks}
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
  unavailableNetworks,
  onPressItem,
  onTopNetworksChange,
}) =>
  editable ? (
    <ChainSelectorEditableView
      networks={networks}
      networkId={networkId}
      unavailableNetworks={unavailableNetworks}
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
