import { useCallback } from 'react';

import { useInTabDialog, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function useShowInternalTransfer() {
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const dialogInTab = useInTabDialog();
  const [account] = usePerpsActiveAccountAtom();
  const isTransferDisabled =
    !account.accountId ||
    !account.accountAddress ||
    accountUtils.isWatchingAccount({ accountId: account.accountId });
  const showInternalTransfer = useCallback(async () => {
    if (isTransferDisabled || !account.accountId || !account.accountAddress)
      return;
    if (gtMd && !platformEnv.isNative) {
      const { showInternalTransferDialog } =
        await import('../components/TradingPanel/modals/InternalTransferModal');
      showInternalTransferDialog(
        {
          userAccountId: account.accountId,
          expectedAccountAddress: account.accountAddress,
        },
        dialogInTab,
      );
      return;
    }
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.InternalTransfer,
      params: {
        userAccountId: account.accountId,
        expectedAccountAddress: account.accountAddress,
      },
    });
  }, [
    account.accountId,
    account.accountAddress,
    isTransferDisabled,
    gtMd,
    dialogInTab,
    navigation,
  ]);
  return { showInternalTransfer, isTransferDisabled };
}
