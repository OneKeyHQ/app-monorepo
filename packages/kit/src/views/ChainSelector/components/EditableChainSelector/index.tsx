import type { FC } from 'react';
import { useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { EditableChainSelectorContent } from './ChainSelectorContent';

type IEditableChainSelectorProps = {
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  unavailableItems: IServerNetwork[];
  frequentlyUsedItems: IServerNetwork[];
  allNetworkItem?: IServerNetwork;
  networkId?: string;
  onPressItem?: (network: IServerNetwork) => void;
  onAddCustomNetwork?: () => void;
  onEditCustomNetwork?: (network: IServerNetwork) => void;
  onFrequentlyUsedItemsChange?: (networks: IServerNetwork[]) => void;
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

export const EditableChainSelector: FC<IEditableChainSelectorProps> = ({
  mainnetItems,
  testnetItems,
  unavailableItems,
  frequentlyUsedItems,
  networkId,
  onPressItem,
  onAddCustomNetwork,
  onEditCustomNetwork,
  onFrequentlyUsedItemsChange,
  allNetworkItem,
}) => {
  const intl = useIntl();
  const [isEditMode, setIsEditMode] = useState(false);
  const headerRight = useMemo(
    () => () =>
      getHeaderRightComponent(
        isEditMode
          ? intl.formatMessage({ id: ETranslations.global_done })
          : intl.formatMessage({ id: ETranslations.global_edit }),
        () => setIsEditMode(!isEditMode),
      ),
    [intl, isEditMode],
  );
  return (
    <Page safeAreaEnabled={false}>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_networks })}
        headerRight={headerRight}
      />
      <Page.Body>
        <EditableChainSelectorContent
          isEditMode={isEditMode}
          frequentlyUsedItems={frequentlyUsedItems}
          unavailableItems={unavailableItems}
          networkId={networkId}
          mainnetItems={mainnetItems}
          testnetItems={testnetItems}
          onPressItem={onPressItem}
          onAddCustomNetwork={onAddCustomNetwork}
          onEditCustomNetwork={onEditCustomNetwork}
          allNetworkItem={allNetworkItem}
          onFrequentlyUsedItemsChange={onFrequentlyUsedItemsChange}
        />
      </Page.Body>
    </Page>
  );
};
