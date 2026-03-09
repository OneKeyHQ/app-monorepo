import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';

export function BatchCreateAccountButton({
  focusedWalletInfo,
  activeAccount: _activeAccount,
  onClose,
}: {
  focusedWalletInfo:
    | {
        wallet: IDBWallet;
        device: IDBDevice | undefined;
      }
    | undefined;
  activeAccount: IAccountSelectorActiveAccountInfo;
  onClose: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleBatchCreateAccount = useCallback(async () => {
    if (!focusedWalletInfo?.wallet?.id) {
      return;
    }
    const walletId = focusedWalletInfo?.wallet?.id || '';

    await backgroundApiProxy.serviceAccount.generateWalletsMissingMetaWithUserInteraction(
      { walletId },
    );
    await backgroundApiProxy.serviceBatchCreateAccount.prepareBatchCreate();

    const ethNetworkId = getNetworkIdsMap().eth;

    // Get compatible networks for this wallet (e.g. BTC-only wallets won't have EVM)
    const { networkIdsCompatible } =
      await backgroundApiProxy.serviceNetwork.getNetworkIdsCompatibleWithWalletId(
        { walletId },
      );

    const allNetworksState =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworksState();

    const isNetworkEnabled = (id: string) =>
      isEnabledNetworksInAllNetworks({
        networkId: id,
        enabledNetworks: allNetworksState.enabledNetworks,
        disabledNetworks: allNetworksState.disabledNetworks,
        isTestnet: false,
      });

    let defaultNetworkId: string | undefined;

    // 1. Prefer Ethereum if compatible and enabled
    if (
      networkIdsCompatible?.includes(ethNetworkId) &&
      isNetworkEnabled(ethNetworkId)
    ) {
      defaultNetworkId = ethNetworkId;
    }

    // 2. Fall back to first enabled EVM network
    if (!defaultNetworkId) {
      defaultNetworkId = networkIdsCompatible?.find(
        (id) =>
          networkUtils.isEvmNetwork({ networkId: id }) && isNetworkEnabled(id),
      );
    }

    // 3. Fall back to first enabled compatible network of any type
    if (!defaultNetworkId) {
      defaultNetworkId =
        networkIdsCompatible?.find((id) => isNetworkEnabled(id)) ??
        networkIdsCompatible?.[0];
    }

    if (!defaultNetworkId) {
      return;
    }

    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.BatchCreateAccountPreview,
      params: {
        walletId,
        networkId: defaultNetworkId,
      },
    });
  }, [focusedWalletInfo, navigation]);

  return (
    <ActionList.Item
      testID="batch-create-account-button-trigger"
      icon="ChecklistOutline"
      label={intl.formatMessage({
        id: ETranslations.global_manage_accounts,
      })}
      onClose={onClose}
      onPress={() => {
        void handleBatchCreateAccount();
      }}
    />
  );
}
