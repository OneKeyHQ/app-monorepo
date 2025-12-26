import { useCallback, useEffect, useMemo, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { cloneDeep } from 'lodash';
import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
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
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import notificationsUtils from '@onekeyhq/shared/src/utils/notificationsUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import {
  ENotificationPushTopicTypes,
  type INotificationPushMessageInfo,
} from '@onekeyhq/shared/types/notification';
import {
  ESwapApproveTransactionStatus,
  ESwapSource,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useDebouncedCallback } from '../../../hooks/useDebounce';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { whenAppUnlocked } from '../../../utils/passwordUtils';
import { handleSwapNavigation } from '../../../views/Swap/hooks/useSwapNavigation';

const InAppNotification = () => {
  const [
    {
      swapHistoryPendingList,
      swapApprovingTransaction,
      speedSwapApprovingTransaction,
    },
    setInAppNotificationAtom,
  ] = useInAppNotificationAtom();
  const swapApprovingTransactionRef = useRef(swapApprovingTransaction);
  if (
    swapApprovingTransactionRef.current !== swapApprovingTransaction ||
    swapApprovingTransactionRef.current?.status !==
      swapApprovingTransaction?.status ||
    swapApprovingTransactionRef.current?.txId !== swapApprovingTransaction?.txId
  ) {
    swapApprovingTransactionRef.current = swapApprovingTransaction
      ? {
          ...swapApprovingTransaction,
        }
      : undefined;
  }

  const speedSwapApprovingTransactionRef = useRef(
    speedSwapApprovingTransaction,
  );
  if (
    speedSwapApprovingTransactionRef.current !==
      speedSwapApprovingTransaction ||
    speedSwapApprovingTransactionRef.current?.status !==
      speedSwapApprovingTransaction?.status ||
    speedSwapApprovingTransactionRef.current?.txId !==
      speedSwapApprovingTransaction?.txId
  ) {
    speedSwapApprovingTransactionRef.current = speedSwapApprovingTransaction
      ? {
          ...speedSwapApprovingTransaction,
        }
      : undefined;
  }

  const intl = useIntl();
  const navigation = useAppNavigation();
  useEffect(() => {
    void backgroundApiProxy.serviceSwap.swapHistoryStatusFetchLoop();
  }, [swapHistoryPendingList]);

  const { activeAccount } = useActiveAccount({ num: 0 });

  const swapLimitOrdersFetchLoopReload = useDebouncedCallback(
    () => {
      if (!activeAccount?.ready) {
        return;
      }
      void backgroundApiProxy.serviceSwap.swapLimitOrdersFetchLoop(
        activeAccount?.indexedAccount?.id,
        !activeAccount?.indexedAccount?.id
          ? activeAccount?.account?.id ?? activeAccount?.dbAccount?.id
          : undefined,
      );
    },
    300,
    {
      leading: false,
      trailing: true,
    },
  );

  useEffect(() => {
    noopObject([
      activeAccount?.indexedAccount?.id,
      activeAccount?.account?.id,
      activeAccount?.dbAccount?.id,
      activeAccount?.ready,
      activeAccount,
      swapLimitOrdersFetchLoopReload,
    ]);

    void swapLimitOrdersFetchLoopReload();
  }, [
    activeAccount?.indexedAccount?.id,
    activeAccount?.account?.id,
    activeAccount?.dbAccount?.id,
    activeAccount?.ready,
    activeAccount,
    swapLimitOrdersFetchLoopReload,
  ]);

  const toastRef = useRef<{ close: () => void } | undefined>(undefined);

  const approvingSuccessActionConfirm = useCallback(async () => {
    toastRef.current?.close();
    handleSwapNavigation(
      ({ isInSwapTab, isHasSwapModal, isSwapModalOnTheTop, hasModal }) => {
        if (isInSwapTab) {
          if (hasModal) {
            // 2.swap tab have modal   关闭当前的所有 modal  通知 swap 进行询价
            rootNavigationRef.current?.goBack();
            setTimeout(async () => {
              await approvingSuccessActionConfirm();
            }, 50);
          } else if (swapApprovingTransactionRef.current) {
            // 1.swap tab no modal
            // 不用做任何动作，直接给 swap 发 event 进行询价
            appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
              approvedSwapInfo: swapApprovingTransactionRef.current,
              enableFilled: true,
            });
          }
        } else if (isHasSwapModal) {
          if (isSwapModalOnTheTop) {
            // 4.no swap tab have swap modal no other modal    最外层是 swap modal 不需要做任何动作通知 swap modal 进行询价
            if (swapApprovingTransactionRef.current) {
              appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
                approvedSwapInfo: swapApprovingTransactionRef.current,
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
        } else if (swapApprovingTransactionRef.current) {
          // 3.no swap tab no swap modal 打开 swap modal 通知 swap 进行询价
          const approvedSwapInfoCopyData = cloneDeep(
            swapApprovingTransactionRef.current,
          );
          navigation.pushModal(EModalRoutes.SwapModal, {
            screen: EModalSwapRoutes.SwapMainLand,
            params: {
              swapTabSwitchType: swapApprovingTransactionRef.current.swapType,
              swapSource: ESwapSource.APPROVING_SUCCESS,
              importFromToken: swapApprovingTransactionRef.current.fromToken,
              importToToken: swapApprovingTransactionRef.current.toToken,
            },
          });
          setTimeout(() => {
            if (approvedSwapInfoCopyData) {
              appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
                approvedSwapInfo: approvedSwapInfoCopyData,
                enableFilled: true,
              });
            }
          }, 200);
        }
      },
    );
  }, [navigation]);

  const approvingSuccessAction = useMemo(() => {
    return (
      <Button
        variant="primary"
        size="small"
        onPress={approvingSuccessActionConfirm}
      >
        <SizableText size="$bodyMdMedium" color="$textInverse">
          {intl.formatMessage({ id: ETranslations.swap_toast_go_to_swap })}
        </SizableText>
      </Button>
    );
  }, [approvingSuccessActionConfirm, intl]);

  useEffect(() => {
    if (
      swapApprovingTransaction?.txId &&
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.PENDING
    ) {
      void backgroundApiProxy.serviceSwap.approvingStateAction();
    } else {
      void backgroundApiProxy.serviceSwap.cleanApprovingInterval();
    }
  }, [swapApprovingTransaction?.txId, swapApprovingTransaction?.status]);

  useEffect(() => {
    if (
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.FAILED
    ) {
      setInAppNotificationAtom((prev) => ({
        ...prev,
        swapApprovingLoading: false,
        swapApprovingTransaction: undefined,
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
        swapApprovingTransaction: undefined,
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
          swapApprovingTransactionRef.current?.resetApproveValue &&
          Number(swapApprovingTransactionRef.current?.resetApproveValue) > 0
        )
      ) {
        let title = intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_successful,
        });
        let message = intl.formatMessage(
          {
            id: ETranslations.swap_toast_go_to_swap_desc,
          },
          {
            num: swapApprovingTransactionRef.current?.amount,
            token: swapApprovingTransactionRef.current?.fromToken.symbol,
            provider: swapApprovingTransactionRef.current?.providerName,
          },
        );
        if (swapApprovingTransactionRef.current?.resetApproveIsMax) {
          message = intl.formatMessage(
            {
              id: ETranslations.swap_toast_go_to_swap_desc_unlimited_approve,
            },
            {
              token: swapApprovingTransactionRef.current?.fromToken.symbol,
              provider: swapApprovingTransactionRef.current?.providerName,
            },
          );
        }
        if (
          new BigNumber(
            swapApprovingTransactionRef.current?.amount ?? 0,
          ).isZero()
        ) {
          message = intl.formatMessage(
            {
              id: ETranslations.global_revoke_approve,
            },
            {
              symbol: swapApprovingTransactionRef.current?.fromToken.symbol,
            },
          );
          title = intl.formatMessage({
            id: ETranslations.swap_revoke_successful,
          });
        }
        handleSwapNavigation(
          ({ isInSwapTab, isHasSwapModal, isSwapModalOnTheTop, hasModal }) => {
            if (
              (isInSwapTab && !hasModal) ||
              (!isInSwapTab && isSwapModalOnTheTop && isHasSwapModal)
            ) {
              if (swapApprovingTransactionRef.current) {
                appEventBus.emit(EAppEventBusNames.SwapApprovingSuccess, {
                  approvedSwapInfo: swapApprovingTransactionRef.current,
                  enableFilled: false,
                });
              }
              Toast.success({
                title,
                message,
              });
            } else {
              toastRef.current = Toast.success({
                title,
                message,
                duration: 10_000,
                actions: approvingSuccessAction,
                actionsAlign: 'left',
                onClose: () => {
                  setInAppNotificationAtom((prev) => ({
                    ...prev,
                    swapApprovingLoading: false,
                    swapApprovingTransaction: undefined,
                  }));
                },
              });
            }
          },
        );
      }
    }
  }, [
    intl,
    setInAppNotificationAtom,
    swapApprovingTransaction?.status,
    approvingSuccessAction,
  ]);

  // speed swap approving state
  useEffect(() => {
    if (
      speedSwapApprovingTransaction?.txId &&
      speedSwapApprovingTransaction?.status ===
        ESwapApproveTransactionStatus.PENDING
    ) {
      void backgroundApiProxy.serviceSwap.speedSwapApprovingStateAction();
    } else {
      void backgroundApiProxy.serviceSwap.cleanSpeedSwapApprovingInterval();
    }
  }, [
    speedSwapApprovingTransaction?.txId,
    speedSwapApprovingTransaction?.status,
  ]);

  useEffect(() => {
    if (
      speedSwapApprovingTransaction?.status ===
      ESwapApproveTransactionStatus.FAILED
    ) {
      setInAppNotificationAtom((prev) => ({
        ...prev,
        speedSwapApprovingLoading: false,
        speedSwapApprovingTransaction: undefined,
      }));
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_failed,
        }),
      });
    } else if (
      speedSwapApprovingTransaction?.status ===
      ESwapApproveTransactionStatus.CANCEL
    ) {
      setInAppNotificationAtom((prev) => ({
        ...prev,
        speedSwapApprovingLoading: false,
        speedSwapApprovingTransaction: undefined,
      }));
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_canceled,
        }),
      });
    } else if (
      speedSwapApprovingTransaction?.status ===
      ESwapApproveTransactionStatus.SUCCESS
    ) {
      if (
        !(
          speedSwapApprovingTransactionRef.current?.resetApproveValue &&
          Number(speedSwapApprovingTransactionRef.current?.resetApproveValue) >
            0
        )
      ) {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.swap_page_toast_approve_successful,
          }),
        });
      } else {
        appEventBus.emit(EAppEventBusNames.SwapSpeedApprovingReset, {
          approvedSwapInfo: speedSwapApprovingTransactionRef.current,
        });
      }
    }
  }, [intl, setInAppNotificationAtom, speedSwapApprovingTransaction?.status]);

  useEffect(() => {
    const callback = ({
      notificationId,
      title,
      description,
      icon,
      remotePushMessageInfo,
    }: {
      notificationId: string | undefined;
      title: string;
      description: string;
      icon: string | undefined;
      remotePushMessageInfo: INotificationPushMessageInfo;
    }) => {
      const topicType = remotePushMessageInfo?.extras?.topic;
      const isSystemTopic =
        (topicType as ENotificationPushTopicTypes) ===
        ENotificationPushTopicTypes.system;
      const toast = Toast.notification({
        title,
        message: description,
        icon: isSystemTopic ? undefined : (icon as IKeyOfIcons),
        iconImageUri: isSystemTopic
          ? undefined
          : remotePushMessageInfo?.extras?.image,
        duration: 10 * 1000,
        imageUri: remotePushMessageInfo?.extras?.image,
        onPress: async () => {
          setTimeout(async () => {
            await whenAppUnlocked();
            await notificationsUtils.navigateToNotificationDetail({
              message: remotePushMessageInfo,
              isFromNotificationClick: true,
              notificationId: notificationId || '',
              notificationAccountId:
                remotePushMessageInfo?.extras?.params?.accountId,
              topicType: topicType as ENotificationPushTopicTypes,
              navigation,
              mode: remotePushMessageInfo?.extras?.mode,
              payload: remotePushMessageInfo?.extras?.payload,
              isRead: false,
            });
          }, 80);
          toast.close();
        },
      });
    };
    appEventBus.on(EAppEventBusNames.ShowInAppPushNotification, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowInAppPushNotification, callback);
    };
  }, [navigation]);

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
