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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

export function BatchCreateAccountButton({
  focusedWalletInfo,
  activeAccount,
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
    await backgroundApiProxy.serviceAccount.generateWalletsMissingMetaWithUserInteraction(
      {
        walletId: focusedWalletInfo?.wallet?.id || '',
      },
    );
    await backgroundApiProxy.serviceBatchCreateAccount.prepareBatchCreate();
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.BatchCreateAccountPreview,
      params: {
        walletId: focusedWalletInfo?.wallet?.id || '',
        networkId: networkUtils.toNetworkIdFallback({
          networkId: activeAccount?.network?.id,
        }),
      },
    });
  }, [focusedWalletInfo, navigation, activeAccount]);

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
