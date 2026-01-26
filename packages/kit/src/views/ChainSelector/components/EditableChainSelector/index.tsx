import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { HeaderIconButton, Page } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';

import { EditableChainSelectorContent } from './ChainSelectorContent';

type IEditableChainSelectorProps = {
  mainnetItems: IServerNetwork[];
  testnetItems: IServerNetwork[];
  unavailableItems: IServerNetwork[];
  frequentlyUsedItems: IServerNetwork[];
  allNetworkItem?: IServerNetwork;
  accountId?: string;
  indexedAccountId?: string;
  networkId?: string;
  walletId?: string;
  onPressItem?: (network: IServerNetwork) => void;
  onAddCustomNetwork?: () => void;
  onEditCustomNetwork?: (network: IServerNetwork) => void;
  onFrequentlyUsedItemsChange?: (networks: IServerNetwork[]) => void;
  recentNetworksEnabled?: boolean;
  accountNetworkValues: Record<string, string>;
  accountNetworkValueCurrency?: string;
  accountDeFiOverview: Record<
    string,
    {
      netWorth: number;
    }
  >;
};

// function getHeaderRightComponent(
//   label: string,
//   handleEditButtonPress: () => void,
// ) {
//   return (
//     <Button variant="tertiary" onPress={handleEditButtonPress}>
//       {label}
//     </Button>
//   );
// }

export const EditableChainSelector: FC<IEditableChainSelectorProps> = ({
  accountNetworkValues,
  accountNetworkValueCurrency,
  mainnetItems,
  testnetItems,
  unavailableItems,
  frequentlyUsedItems,
  accountId,
  indexedAccountId,
  walletId,
  networkId,
  onPressItem,
  onAddCustomNetwork,
  onEditCustomNetwork,
  onFrequentlyUsedItemsChange,
  allNetworkItem,
  recentNetworksEnabled = true,
  accountDeFiOverview,
}) => {
  const intl = useIntl();
  // const [isEditMode, setIsEditMode] = useState(false);
  const [allNetworksChanged, setAllNetworksChanged] = useState(false);
  const headerRight = useCallback(
    () => (
      <HeaderIconButton
        icon="PlusLargeSolid"
        onPress={() => onAddCustomNetwork?.()}
        title={intl.formatMessage({
          id: ETranslations.custom_network_add_network_action_text,
        })}
      />
    ),
    [onAddCustomNetwork, intl],
  );
  return (
    <Page
      lazyLoad
      safeAreaEnabled={false}
      onClose={() => {
        if (allNetworksChanged && networkUtils.isAllNetwork({ networkId })) {
          appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
        }
      }}
    >
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_networks })}
        headerRight={headerRight}
      />
      <Page.Body>
        <EditableChainSelectorContent
          // isEditMode={isEditMode}
          frequentlyUsedItems={frequentlyUsedItems}
          unavailableItems={unavailableItems}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          walletId={walletId}
          networkId={networkId}
          mainnetItems={mainnetItems}
          testnetItems={testnetItems}
          onPressItem={onPressItem}
          onAddCustomNetwork={onAddCustomNetwork}
          onEditCustomNetwork={onEditCustomNetwork}
          allNetworkItem={allNetworkItem}
          onFrequentlyUsedItemsChange={onFrequentlyUsedItemsChange}
          setAllNetworksChanged={setAllNetworksChanged}
          recentNetworksEnabled={recentNetworksEnabled}
          accountNetworkValues={accountNetworkValues}
          accountNetworkValueCurrency={accountNetworkValueCurrency}
          accountDeFiOverview={accountDeFiOverview}
        />
      </Page.Body>
    </Page>
  );
};
