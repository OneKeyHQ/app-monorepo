import { useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { EPageType, usePageType } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import {
  ESwapApproveTransactionStatus,
  ESwapDirectionType,
  type ISwapApproveTransaction,
} from '@onekeyhq/shared/types/swap/types';

import { useDebounce } from '../../../hooks/useDebounce';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapApproveAllowanceSelectOpenAtom,
  useSwapFromTokenAmountAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapSlippageDialogOpeningAtom,
} from '../../../states/jotai/contexts/swap';
import { truncateDecimalPlaces } from '../utils/utils';

import { useSwapAddressInfo } from './useSwapAccount';

export function useSwapQuote() {
  const intl = useIntl();
  const {
    quoteAction,
    cleanQuoteInterval,
    recoverQuoteInterval,
    quoteEventHandler,
  } = useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [swapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [{ swapApprovingTransaction }] = useInAppNotificationAtom();
  const [swapShouldRefresh] = useSwapShouldRefreshQuoteAtom();
  const swapShouldRefreshRef = useRef(swapShouldRefresh);
  if (swapShouldRefreshRef.current !== swapShouldRefresh) {
    swapShouldRefreshRef.current = swapShouldRefresh;
  }
  const isFocused = useIsFocused();
  const isFocusRef = useRef(isFocused);
  if (isFocusRef.current !== isFocused) {
    isFocusRef.current = isFocused;
  }
  const activeAccountRef = useRef<
    ReturnType<typeof useSwapAddressInfo> | undefined
  >();
  if (activeAccountRef.current !== swapAddressInfo) {
    activeAccountRef.current = swapAddressInfo;
  }
  const swapApprovingTxRef = useRef<ISwapApproveTransaction | undefined>();
  if (swapApprovingTxRef.current !== swapApprovingTransaction) {
    swapApprovingTxRef.current = swapApprovingTransaction;
  }
  const fromAmountDebounce = useDebounce(fromTokenAmount, 500, {
    leading: true,
  });
  const alignmentDecimal = useCallback(() => {
    const checkedDecimal = truncateDecimalPlaces(
      fromAmountDebounce,
      fromToken?.decimals,
    );
    if (checkedDecimal && checkedDecimal !== fromAmountDebounce) {
      setFromTokenAmount(checkedDecimal);
    }
  }, [fromToken?.decimals, fromAmountDebounce, setFromTokenAmount]);

  useEffect(() => {
    if (!isFocusRef.current) return;
    if (!fromTokenAmount) {
      void quoteAction(
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
      );
    }
  }, [fromTokenAmount, quoteAction]);

  useEffect(() => {
    if (swapSlippageDialogOpening.status || swapApproveAllowanceSelectOpen) {
      cleanQuoteInterval();
    } else if (
      !swapSlippageDialogOpening.status &&
      swapSlippageDialogOpening.flag === 'save'
    ) {
      void quoteAction(
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
      );
    } else {
      void recoverQuoteInterval(
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
      );
    }
  }, [
    quoteAction,
    cleanQuoteInterval,
    recoverQuoteInterval,
    swapApproveAllowanceSelectOpen,
    swapSlippageDialogOpening,
  ]);

  useEffect(() => {
    if (!isFocusRef.current) return;
    if (
      swapApprovingTransaction &&
      swapApprovingTransaction.txId &&
      swapApprovingTransaction.status ===
        ESwapApproveTransactionStatus.SUCCESS &&
      !swapApprovingTransaction.resetApproveValue
    ) {
      void quoteAction(
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
        swapApprovingTransaction.blockNumber,
      );
    }
  }, [intl, cleanQuoteInterval, quoteAction, swapApprovingTransaction]);

  useEffect(() => {
    if (!isFocusRef.current) return;
    if (
      fromToken?.networkId !== activeAccountRef.current?.networkId ||
      (fromToken?.networkId === toToken?.networkId &&
        fromToken?.contractAddress === toToken?.contractAddress)
    ) {
      return;
    }
    alignmentDecimal();
    void quoteAction(
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
    );
    return () => {
      cleanQuoteInterval();
    };
  }, [
    cleanQuoteInterval,
    quoteAction,
    swapAddressInfo.address,
    swapAddressInfo.networkId,
    fromToken,
    toToken?.networkId,
    toToken?.contractAddress,
    alignmentDecimal,
  ]);

  // Due to the changes in derived types causing address changes, this is not in the swap tab.
  useEffect(() => {
    if (isFocusRef.current) return;
    if (
      fromToken?.networkId !== activeAccountRef.current?.networkId ||
      (fromToken?.networkId === toToken?.networkId &&
        fromToken?.contractAddress === toToken?.contractAddress)
    ) {
      return;
    }
    alignmentDecimal();
    void quoteAction(
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
    );
    return () => {
      cleanQuoteInterval();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapAddressInfo.address]);

  const pageType = usePageType();
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (pageType !== EPageType.modal) {
        if (isFocus) {
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
          appEventBus.on(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        } else {
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        }
      }
      setTimeout(() => {
        // ext env txId data is undefined when useListenTabFocusState is called
        if (pageType !== EPageType.modal) {
          if (
            isFocus &&
            !isHiddenModel &&
            !swapApprovingTxRef.current?.txId &&
            !swapShouldRefreshRef.current
          ) {
            void recoverQuoteInterval(
              activeAccountRef.current?.address,
              activeAccountRef.current?.accountInfo?.account?.id,
            );
          } else {
            cleanQuoteInterval();
          }
        }
      }, 100);
    },
  );
  useEffect(() => {
    if (pageType === EPageType.modal) {
      if (isFocused) {
        appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        appEventBus.on(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
      } else {
        appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
      }
    }
    return () => {
      if (pageType === EPageType.modal) {
        appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
      }
    };
  }, [isFocused, pageType, quoteEventHandler]);

  useEffect(() => {
    setTimeout(() => {
      if (pageType === EPageType.modal) {
        if (
          isFocused &&
          !swapApprovingTxRef.current?.txId &&
          !swapShouldRefreshRef.current
        ) {
          void recoverQuoteInterval(
            activeAccountRef.current?.address,
            activeAccountRef.current?.accountInfo?.account?.id,
          );
        } else {
          cleanQuoteInterval();
        }
      }
    }, 100);
  }, [cleanQuoteInterval, isFocused, pageType, recoverQuoteInterval]);
}
