import { useEffect, useRef } from 'react';

import { useIsFocused } from '@react-navigation/core';

import { Toast, usePageType } from '@onekeyhq/components';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { ISwapApproveTransaction } from '@onekeyhq/shared/types/swap/types';
import { ESwapApproveTransactionStatus } from '@onekeyhq/shared/types/swap/types';

import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapApprovingTransactionAtom,
} from '../../../states/jotai/contexts/swap';

export function useSwapApproving() {
  const { approvingStateAction, cleanApprovingInterval } =
    useSwapActions().current;
  const [swapApprovingTransactionAtom] = useSwapApprovingTransactionAtom();

  const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>();
  if (swapApprovingTxRef.current !== swapApprovingTransactionAtom) {
    swapApprovingTxRef.current = swapApprovingTransactionAtom;
  }

  useEffect(() => {
    if (
      swapApprovingTransactionAtom?.txId &&
      swapApprovingTransactionAtom?.status ===
        ESwapApproveTransactionStatus.PENDING
    ) {
      void approvingStateAction();
    } else {
      cleanApprovingInterval();
    }
    if (
      swapApprovingTransactionAtom?.status ===
      ESwapApproveTransactionStatus.FAILED
    ) {
      Toast.error({ title: 'Failed to approve' });
    } else if (
      swapApprovingTransactionAtom?.status ===
      ESwapApproveTransactionStatus.CANCEL
    ) {
      Toast.error({ title: 'Approve canceled' });
    } else if (
      swapApprovingTransactionAtom?.status ===
      ESwapApproveTransactionStatus.SUCCESS
    ) {
      Toast.success({ title: 'Approve success' });
    }
    return () => {
      cleanApprovingInterval();
    };
  }, [
    approvingStateAction,
    cleanApprovingInterval,
    swapApprovingTransactionAtom?.status,
    swapApprovingTransactionAtom?.txId,
  ]);

  const pageType = usePageType();
  const pageTypeRef = useRef<string | undefined>();
  if (pageTypeRef.current !== pageType) {
    pageTypeRef.current = pageType;
  }
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (pageTypeRef.current !== 'modal') {
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
  const isFocused = useIsFocused();
  useEffect(() => {
    if (pageType === 'modal') {
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
