import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapApproveTransactionStatus } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

const InAppNotification = () => {
  const [
    { swapHistoryPendingList, swapApprovingTransaction },
    setInAppNotificationAtom,
  ] = useInAppNotificationAtom();
  const intl = useIntl();
  useEffect(() => {
    void backgroundApiProxy.serviceSwap.swapHistoryStatusFetchLoop();
  }, [swapHistoryPendingList]);

  const { activeAccount } = useActiveAccount({ num: 0 });

  useEffect(() => {
    if (!activeAccount?.ready) {
      return;
    }
    void backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop(
      activeAccount?.indexedAccount?.id,
      !activeAccount?.indexedAccount?.id
        ? activeAccount?.account?.id ?? activeAccount?.dbAccount?.id
        : undefined,
    );
  }, [
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    activeAccount?.dbAccount?.id,
    activeAccount?.ready,
    activeAccount,
  ]);

  useEffect(() => {
    if (
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.FAILED
    ) {
      setInAppNotificationAtom((prev) => ({
        ...prev,
        swapApprovingLoading: false,
      }));
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_failed,
        }),
      });
    } else if (
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.CANCEL
    ) {
      setInAppNotificationAtom((prev) => ({
        ...prev,
        swapApprovingLoading: false,
      }));
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_canceled,
        }),
      });
    } else if (
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.SUCCESS
    ) {
      if (
        !(
          swapApprovingTransaction?.resetApproveValue &&
          Number(swapApprovingTransaction?.resetApproveValue) > 0
        )
      ) {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.swap_page_toast_approve_successful,
          }),
        });
      }
    }
    if (
      swapApprovingTransaction?.status ===
        ESwapApproveTransactionStatus.FAILED ||
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.CANCEL
    ) {
      setInAppNotificationAtom((prev) => ({
        ...prev,
        swapApprovingTransaction: undefined,
      }));
    }
  }, [
    intl,
    setInAppNotificationAtom,
    swapApprovingTransaction?.resetApproveIsMax,
    swapApprovingTransaction?.resetApproveValue,
    swapApprovingTransaction?.status,
    swapApprovingTransaction?.txId,
  ]);

  return null;
};

export default function InAppNotificationWithAccount() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <InAppNotification />
    </AccountSelectorProviderMirror>
  );
}
