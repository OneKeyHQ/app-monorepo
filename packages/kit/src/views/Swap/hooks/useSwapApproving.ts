import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { EPageType, Toast, usePageType } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ISwapApproveTransaction } from '@onekeyhq/shared/types/swap/types';
import { ESwapApproveTransactionStatus } from '@onekeyhq/shared/types/swap/types';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import { useSwapActions } from '../../../states/jotai/contexts/swap';

import { useSwapBuildTx } from './useSwapBuiltTx';

export function useSwapApproving() {
  const intl = useIntl();
  const { approvingStateAction, cleanApprovingInterval } =
    useSwapActions().current;
  const [{ swapApprovingTransaction }, setInAppNotificationAtom] =
    useInAppNotificationAtom();
  const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>();
  if (swapApprovingTxRef.current !== swapApprovingTransaction) {
    swapApprovingTxRef.current = swapApprovingTransaction;
  }
  const { approveTx } = useSwapBuildTx();
  const approveTxRef = useRef(approveTx);
  if (approveTxRef.current !== approveTx) {
    approveTxRef.current = approveTx;
  }
  const isFocused = useIsFocused();
  const isFocusRef = useRef(isFocused);
  if (isFocusRef.current !== isFocused) {
    isFocusRef.current = isFocused;
  }
  useEffect(() => {
    if (!isFocusRef.current) return;
    if (
      swapApprovingTransaction?.txId &&
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.PENDING
    ) {
      void approvingStateAction();
    } else {
      cleanApprovingInterval();
    }
    if (
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.FAILED
    ) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_failed,
        }),
      });
    } else if (
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.CANCEL
    ) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_canceled,
        }),
      });
    } else if (
      swapApprovingTransaction?.status === ESwapApproveTransactionStatus.SUCCESS
    ) {
      if (
        swapApprovingTransaction?.resetApproveValue &&
        Number(swapApprovingTransaction?.resetApproveValue) > 0
      ) {
        void approveTxRef.current?.(
          swapApprovingTransaction?.resetApproveValue,
          !!swapApprovingTransaction?.resetApproveIsMax,
        );
      } else {
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
    return () => {
      cleanApprovingInterval();
    };
  }, [
    approvingStateAction,
    cleanApprovingInterval,
    intl,
    setInAppNotificationAtom,
    swapApprovingTransaction?.resetApproveIsMax,
    swapApprovingTransaction?.resetApproveValue,
    swapApprovingTransaction?.status,
    swapApprovingTransaction?.txId,
  ]);

  const pageType = usePageType();
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (pageType !== EPageType.modal) {
        if (
          isFocus &&
          !isHiddenModel &&
          swapApprovingTxRef.current?.txId &&
          swapApprovingTxRef.current?.status ===
            ESwapApproveTransactionStatus.PENDING
        ) {
          void approvingStateAction();
        } else {
          cleanApprovingInterval();
        }
      }
    },
  );
  useEffect(() => {
    if (pageType === EPageType.modal) {
      if (
        isFocused &&
        swapApprovingTxRef.current?.txId &&
        swapApprovingTxRef.current?.status ===
          ESwapApproveTransactionStatus.PENDING
      ) {
        void approvingStateAction();
      } else {
        cleanApprovingInterval();
      }
    }
  }, [approvingStateAction, cleanApprovingInterval, isFocused, pageType]);
}
