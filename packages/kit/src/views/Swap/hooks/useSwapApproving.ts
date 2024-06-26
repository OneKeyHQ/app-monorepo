import { useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { EPageType, Toast, usePageType } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ISwapApproveTransaction } from '@onekeyhq/shared/types/swap/types';
import { ESwapApproveTransactionStatus } from '@onekeyhq/shared/types/swap/types';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapApprovingTransactionAtom,
} from '../../../states/jotai/contexts/swap';

import { useSwapBuildTx } from './useSwapBuiltTx';

export function useSwapApproving() {
  const intl = useIntl();
  const { approvingStateAction, cleanApprovingInterval } =
    useSwapActions().current;
  const [swapApprovingTransactionAtom] = useSwapApprovingTransactionAtom();
  const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>();
  if (swapApprovingTxRef.current !== swapApprovingTransactionAtom) {
    swapApprovingTxRef.current = swapApprovingTransactionAtom;
  }
  const { approveTx } = useSwapBuildTx();
  const approveTxRef = useRef(approveTx);
  if (approveTxRef.current !== approveTx) {
    approveTxRef.current = approveTx;
  }
  useEffect(() => {
    if (
      swapApprovingTransactionAtom?.txId &&
      (swapApprovingTransactionAtom?.status ===
        ESwapApproveTransactionStatus.PENDING ||
        swapApprovingTransactionAtom?.status ===
          ESwapApproveTransactionStatus.DISCARD)
    ) {
      void approvingStateAction();
    } else {
      cleanApprovingInterval();
    }
    if (
      swapApprovingTransactionAtom?.status ===
      ESwapApproveTransactionStatus.FAILED
    ) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_failed,
        }),
      });
    } else if (
      swapApprovingTransactionAtom?.status ===
      ESwapApproveTransactionStatus.CANCEL
    ) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.swap_page_toast_approve_canceled,
        }),
      });
    } else if (
      swapApprovingTransactionAtom?.status ===
      ESwapApproveTransactionStatus.SUCCESS
    ) {
      if (
        swapApprovingTransactionAtom?.resetApproveValue &&
        Number(swapApprovingTransactionAtom?.resetApproveValue) > 0
      ) {
        void approveTxRef.current?.(
          swapApprovingTransactionAtom?.resetApproveValue,
          !!swapApprovingTransactionAtom?.resetApproveIsMax,
        );
      } else {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.swap_page_toast_approve_successful,
          }),
        });
      }
    }
    return () => {
      cleanApprovingInterval();
    };
  }, [
    approvingStateAction,
    cleanApprovingInterval,
    intl,
    swapApprovingTransactionAtom?.resetApproveIsMax,
    swapApprovingTransactionAtom?.resetApproveValue,
    swapApprovingTransactionAtom?.status,
    swapApprovingTransactionAtom?.txId,
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
          (swapApprovingTxRef.current?.status ===
            ESwapApproveTransactionStatus.PENDING ||
            swapApprovingTxRef.current?.status ===
              ESwapApproveTransactionStatus.DISCARD)
        ) {
          void approvingStateAction();
        } else {
          cleanApprovingInterval();
        }
      }
    },
  );
  const isFocused = useIsFocused();
  useEffect(() => {
    if (pageType === EPageType.modal) {
      if (
        isFocused &&
        swapApprovingTxRef.current?.txId &&
        (swapApprovingTxRef.current?.status ===
          ESwapApproveTransactionStatus.PENDING ||
          swapApprovingTxRef.current?.status ===
            ESwapApproveTransactionStatus.DISCARD)
      ) {
        void approvingStateAction();
      } else {
        cleanApprovingInterval();
      }
    }
  }, [approvingStateAction, cleanApprovingInterval, isFocused, pageType]);
}
