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
  activeAccount,
  currentNetworkId,
  onClose,
}: {
  focusedWalletInfo:
    | {
        wallet: IDBWallet;
        device: IDBDevice | undefined;
      }
    | undefined;
  activeAccount: IAccountSelectorActiveAccountInfo;
  currentNetworkId?: string;
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
    const preferredNetworkId = currentNetworkId ?? activeAccount.network?.id;

    // 1. In single-chain mode, keep the manager aligned with the current network.
    // The current network may be outside the portfolio-enabled list, but if the
    // user is already on that chain we should still use it as the default.
    if (
      preferredNetworkId &&
      !networkUtils.isAllNetwork({ networkId: preferredNetworkId }) &&
      networkIdsCompatible?.includes(preferredNetworkId)
    ) {
      defaultNetworkId = preferredNetworkId;
    }

    // 2. Prefer Ethereum if compatible and enabled
    if (
      !defaultNetworkId &&
      networkIdsCompatible?.includes(ethNetworkId) &&
      isNetworkEnabled(ethNetworkId)
    ) {
      defaultNetworkId = ethNetworkId;
    }

    // 3. Fall back to first enabled EVM network
    if (!defaultNetworkId) {
      defaultNetworkId = networkIdsCompatible?.find(
        (id) =>
          networkUtils.isEvmNetwork({ networkId: id }) && isNetworkEnabled(id),
      );
    }

    // 4. Fall back to first enabled compatible network of any type
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
  }, [
    activeAccount.network?.id,
    currentNetworkId,
    focusedWalletInfo,
    navigation,
  ]);

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
