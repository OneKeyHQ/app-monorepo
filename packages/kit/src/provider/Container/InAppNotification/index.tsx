import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  SizableText,
  Toast,
  rootNavigationRef,
} from '@onekeyhq/components';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { ESwapApproveTransactionStatus } from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
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

  const approvingSuccessActionConfirm = useCallback(async () => {
    // 1.swap tab no modal
    // 2.swap tab have modal
    // 3.no swap tab no swap modal
    // 4.no swap tab have swap modal no other modal
    // 5.no swap tab have swap modal have other modal
  }, []);

  const approvingSuccessAction = useMemo(() => {
    return (
      <Button
        variant="secondary"
        size="small"
        onPress={approvingSuccessActionConfirm}
      >
        <SizableText>Go to swap</SizableText>
      </Button>
    );
  }, [approvingSuccessActionConfirm]);

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
          message: intl.formatMessage({
            id: ETranslations.swap_page_toast_approve_successful,
          }),
          duration: 300_000,
          actions: approvingSuccessAction,
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
    approvingSuccessAction,
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
