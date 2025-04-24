import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  SizableText,
  Toast,
  rootNavigationRef,
} from '@onekeyhq/components';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EModalSwapRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  ESwapApproveTransactionStatus,
  ESwapSource,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { handleSwapNavigation } from '../../../views/Swap/hooks/useSwapNavigation';

const InAppNotification = () => {
  const [
    { swapHistoryPendingList, swapApprovingTransaction },
    setInAppNotificationAtom,
  ] = useInAppNotificationAtom();
  const intl = useIntl();
  const navigation = useAppNavigation();
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

  const toastRef = useRef<{ close: () => void } | undefined>();

  const approvingSuccessActionConfirm = useCallback(async () => {
    handleSwapNavigation(
      ({ isInSwapTab, isHasSwapModal, isSwapModalOnTheTop, hasModal }) => {
        if (isInSwapTab) {
          if (hasModal) {
            // 2.swap tab have modal   关闭当前的所有 modal  通知 swap 进行询价
            rootNavigationRef.current?.goBack();
            setTimeout(async () => {
              await approvingSuccessActionConfirm();
            }, 50);
          } else if (swapApprovingTransaction) {
            // 1.swap tab no modal
            // 不用做任何动作，直接给 swap 发 event 进行询价
            appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
              approvedSwapInfo: swapApprovingTransaction,
              enableFilled: true,
            });
          }
        } else if (isHasSwapModal) {
          if (isSwapModalOnTheTop) {
            // 4.no swap tab have swap modal no other modal    最外层是 swap modal 不需要做任何动作通知 swap modal 进行询价
            if (swapApprovingTransaction) {
              appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
                approvedSwapInfo: swapApprovingTransaction,
                enableFilled: true,
              });
            }
          } else {
            // 5.no swap tab have swap modal have other modal   退回到 swap modal  再通知 swap modal 进行询价
            rootNavigationRef.current?.goBack();
            setTimeout(async () => {
              await approvingSuccessActionConfirm();
            }, 50);
          }
        } else if (swapApprovingTransaction) {
          // 3.no swap tab no swap modal 打开 swap modal 通知 swap 进行询价

          navigation.pushModal(EModalRoutes.SwapModal, {
            screen: EModalSwapRoutes.SwapMainLand,
            params: {
              swapTabSwitchType: swapApprovingTransaction.swapType,
              swapSource: ESwapSource.APPROVING_SUCCESS,
              importFromToken: swapApprovingTransaction.fromToken,
              importToToken: swapApprovingTransaction.toToken,
            },
          });
          setTimeout(() => {
            appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
              approvedSwapInfo: swapApprovingTransaction,
              enableFilled: true,
            });
          }, 300);
        }
      },
    );
    toastRef.current?.close();
  }, [swapApprovingTransaction, navigation]);

  const approvingSuccessAction = useMemo(() => {
    return (
      <Button
        variant="secondary"
        size="small"
        onPress={approvingSuccessActionConfirm}
      >
        <SizableText>
          {intl.formatMessage({ id: ETranslations.swap_toast_go_to_swap })}
        </SizableText>
      </Button>
    );
  }, [approvingSuccessActionConfirm, intl]);

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
        const message = intl.formatMessage(
          {
            id: ETranslations.swap_toast_go_to_swap_desc,
          },
          {
            num: swapApprovingTransaction.amount,
            token: swapApprovingTransaction.fromToken.symbol,
            provider: swapApprovingTransaction.providerName,
          },
        );
        handleSwapNavigation(
          ({ isInSwapTab, isHasSwapModal, isSwapModalOnTheTop, hasModal }) => {
            if (
              (isInSwapTab && !hasModal) ||
              (!isInSwapTab && isSwapModalOnTheTop && isHasSwapModal)
            ) {
              appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
                approvedSwapInfo: swapApprovingTransaction,
                enableFilled: false,
              });
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.swap_page_toast_approve_successful,
                }),
                message,
              });
            } else {
              toastRef.current = Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.swap_page_toast_approve_successful,
                }),
                message,
                duration: 10_000,
                actions: approvingSuccessAction,
                actionsAlign: 'left',
              });
            }
          },
        );
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
    swapApprovingTransaction,
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
