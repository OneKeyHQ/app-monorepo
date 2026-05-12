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

import { ChainSelectorTestIDs } from '../../testIDs';

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
  recentNetworksEnabled?: boolean;
  accountNetworkValues: Record<string, string>;
  accountNetworkValueCurrency?: string;
  accountDeFiOverview: Record<
    string,
    {
      netWorth: number;
    }
  >;
  showAllNetworkInRecentNetworks?: boolean;
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
  allNetworkItem,
  recentNetworksEnabled = true,
  accountDeFiOverview,
  showAllNetworkInRecentNetworks,
}) => {
  const intl = useIntl();
  const [allNetworksChanged, setAllNetworksChanged] = useState(false);
  const headerRight = useCallback(
    () => (
      <HeaderIconButton
        icon="PlusLargeSolid"
        onPress={() => onAddCustomNetwork?.()}
        testID={ChainSelectorTestIDs.addCustomNetworkBtn}
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
          frequentlyUsedItems={frequentlyUsedItems}
          unavailableItems={unavailableItems}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          walletId={walletId}
          networkId={networkId}
          mainnetItems={mainnetItems}
          testnetItems={testnetItems}
          onPressItem={onPressItem}
          onEditCustomNetwork={onEditCustomNetwork}
          allNetworkItem={allNetworkItem}
          setAllNetworksChanged={setAllNetworksChanged}
          recentNetworksEnabled={recentNetworksEnabled}
          accountNetworkValues={accountNetworkValues}
          accountNetworkValueCurrency={accountNetworkValueCurrency}
          accountDeFiOverview={accountDeFiOverview}
          showAllNetworkInRecentNetworks={showAllNetworkInRecentNetworks}
        />
      </Page.Body>
    </Page>
  );
};
