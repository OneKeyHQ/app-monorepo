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
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
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
  useSwapQuoteActionLockAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
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
  const [swapQuoteActionLock] = useSwapQuoteActionLockAtom();
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [swapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [swapQuoteResultList, setSwapQuoteResultList] = useSwapQuoteListAtom();
  const [swapQuoteEventTotalCount, setSwapQuoteEventTotalCount] =
    useSwapQuoteEventTotalCountAtom();
  const [swapQuoteFetching] = useSwapQuoteFetchingAtom();
  const { closeQuoteEvent } = useSwapActions().current;
  const [{ swapApprovingTransaction }] = useInAppNotificationAtom();
  const [swapShouldRefresh] = useSwapShouldRefreshQuoteAtom();
  const swapShouldRefreshRef = useRef(swapShouldRefresh);
  const swapQuoteActionLockRef = useRef(swapQuoteActionLock);
  const swapQuoteFetchingRef = useRef(swapQuoteFetching);
  if (swapQuoteFetchingRef.current !== swapQuoteFetching) {
    swapQuoteFetchingRef.current = swapQuoteFetching;
  }
  const swapQuoteResultListRef = useRef(swapQuoteResultList);
  if (swapQuoteResultListRef.current !== swapQuoteResultList) {
    swapQuoteResultListRef.current = swapQuoteResultList;
  }
  const swapQuoteEventTotalCountRef = useRef(swapQuoteEventTotalCount);
  if (swapQuoteEventTotalCountRef.current !== swapQuoteEventTotalCount) {
    swapQuoteEventTotalCountRef.current = swapQuoteEventTotalCount;
  }
  if (swapQuoteActionLockRef.current !== swapQuoteActionLock) {
    swapQuoteActionLockRef.current = swapQuoteActionLock;
  }
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
      equalTokenNoCaseSensitive({
        token1: {
          networkId: fromToken?.networkId,
          contractAddress: fromToken?.contractAddress,
        },
        token2: {
          networkId: toToken?.networkId,
          contractAddress: toToken?.contractAddress,
        },
      })
    ) {
      return;
    }
    // fromToken & address change will trigger effect twice. so this use skip
    if (
      swapQuoteActionLockRef.current?.actionLock &&
      swapQuoteActionLockRef.current?.fromTokenAmount === fromAmountDebounce &&
      equalTokenNoCaseSensitive({
        token1: swapQuoteActionLockRef.current?.fromToken,
        token2: {
          networkId: fromToken?.networkId,
          contractAddress: fromToken?.contractAddress,
        },
      }) &&
      equalTokenNoCaseSensitive({
        token1: swapQuoteActionLockRef.current?.toToken,
        token2: {
          networkId: toToken?.networkId,
          contractAddress: toToken?.contractAddress,
        },
      }) &&
      swapQuoteActionLockRef.current.accountId ===
        activeAccountRef.current?.accountInfo?.account?.id &&
      swapQuoteActionLockRef.current?.address === swapAddressInfo.address
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
    fromToken?.networkId,
    fromToken?.contractAddress,
    toToken?.networkId,
    toToken?.contractAddress,
    alignmentDecimal,
    fromAmountDebounce,
  ]);

  // Due to the changes in derived types causing address changes, this is not in the swap tab.
  useEffect(() => {
    if (isFocusRef.current) return;
    if (
      fromToken?.networkId !== activeAccountRef.current?.networkId ||
      equalTokenNoCaseSensitive({
        token1: {
          networkId: fromToken?.networkId,
          contractAddress: fromToken?.contractAddress,
        },
        token2: {
          networkId: toToken?.networkId,
          contractAddress: toToken?.contractAddress,
        },
      })
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
  }, [swapAddressInfo.accountInfo?.deriveType]);

  const pageType = usePageType();
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (pageType !== EPageType.modal) {
        if (isFocus) {
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
          appEventBus.on(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        } else if (isHiddenModel) {
          if (
            swapQuoteFetchingRef.current ||
            (swapQuoteEventTotalCountRef.current > 0 &&
              swapQuoteResultListRef.current.length <
                swapQuoteEventTotalCountRef.current)
          ) {
            // reset tab quote data when swap modal is open and tab quote data is fetching
            closeQuoteEvent();
            setSwapQuoteEventTotalCount(0);
            setSwapQuoteResultList([]);
            setFromTokenAmount('');
          }
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        } else {
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
          appEventBus.on(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
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
      }
    }
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
