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
  ESwapQuoteKind,
  ESwapTabSwitchType,
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
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { truncateDecimalPlaces } from '../utils/utils';

import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapSlippagePercentageModeInfo } from './useSwapState';

export function useSwapQuote() {
  const intl = useIntl();
  const {
    quoteAction,
    cleanQuoteInterval,
    // recoverQuoteInterval,
    quoteEventHandler,
  } = useSwapActions().current;
  const [swapQuoteActionLock] = useSwapQuoteActionLockAtom();
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const [fromToken] = useSwapSelectFromTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [toToken] = useSwapSelectToTokenAtom();
  const [swapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [swapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toTokenAmount, setToTokenAmount] = useSwapToTokenAmountAtom();
  const [swapQuoteResultList, setSwapQuoteResultList] = useSwapQuoteListAtom();
  const [swapQuoteEventTotalCount, setSwapQuoteEventTotalCount] =
    useSwapQuoteEventTotalCountAtom();
  const [swapQuoteFetching] = useSwapQuoteFetchingAtom();
  const { closeQuoteEvent } = useSwapActions().current;
  const [{ swapApprovingTransaction }] = useInAppNotificationAtom();
  const [swapShouldRefresh] = useSwapShouldRefreshQuoteAtom();
  const [swapTabSwitchType] = useSwapTypeSwitchAtom();

  const swapTabSwitchTypeRef = useRef(swapTabSwitchType);
  const swapShouldRefreshRef = useRef(swapShouldRefresh);
  const swapQuoteActionLockRef = useRef(swapQuoteActionLock);
  const swapQuoteFetchingRef = useRef(swapQuoteFetching);

  const swapSlippageRef = useRef(slippageItem);

  if (swapTabSwitchTypeRef.current !== swapTabSwitchType) {
    swapTabSwitchTypeRef.current = swapTabSwitchType;
  }
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
  if (swapSlippageRef.current !== slippageItem) {
    swapSlippageRef.current = slippageItem;
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

  const toAmountDebounce = useDebounce(toTokenAmount, 500, {
    leading: true,
  });

  const toAmountDebounceRef = useRef(toAmountDebounce);
  if (toAmountDebounceRef.current !== toAmountDebounce) {
    toAmountDebounceRef.current = toAmountDebounce;
  }

  const alignmentDecimal = useCallback(() => {
    const checkedDecimal = truncateDecimalPlaces(
      fromAmountDebounce.value,
      fromToken?.decimals,
    );
    if (checkedDecimal && checkedDecimal !== fromAmountDebounce.value) {
      setFromTokenAmount((v) => ({
        ...v,
        value: checkedDecimal,
      }));
    }
  }, [fromToken?.decimals, fromAmountDebounce, setFromTokenAmount]);

  const alignmentToDecimal = useCallback(() => {
    const checkedDecimal = truncateDecimalPlaces(
      toAmountDebounce.value,
      toToken?.decimals,
    );
    if (checkedDecimal && checkedDecimal !== toAmountDebounce.value) {
      setToTokenAmount((v) => ({
        ...v,
        value: checkedDecimal,
      }));
    }
  }, [toToken?.decimals, toAmountDebounce, setToTokenAmount]);

  useEffect(() => {
    if (!isFocusRef.current) return;
    if (!fromTokenAmount.value && fromTokenAmount.isInput) {
      void quoteAction(
        swapSlippageRef.current,
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
      );
    }
  }, [fromTokenAmount, quoteAction]);

  useEffect(() => {
    if (!isFocusRef.current) return;
    if (
      !toTokenAmount.value &&
      toTokenAmount.isInput &&
      swapTabSwitchTypeRef.current === ESwapTabSwitchType.LIMIT
    ) {
      void quoteAction(
        swapSlippageRef.current,
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
        undefined,
        undefined,
        ESwapQuoteKind.BUY,
      );
    }
  }, [toTokenAmount, quoteAction]);

  useEffect(() => {
    if (swapSlippageDialogOpening.status || swapApproveAllowanceSelectOpen) {
      // cleanQuoteInterval();
    } else if (
      !swapSlippageDialogOpening.status &&
      swapSlippageDialogOpening.flag === 'save'
    ) {
      void quoteAction(
        swapSlippageRef.current,
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
        undefined,
        undefined,
        ESwapQuoteKind.SELL,
      );
    }
    // else {
    // void recoverQuoteInterval(
    //   swapSlippageRef.current,
    //   activeAccountRef.current?.address,
    //   activeAccountRef.current?.accountInfo?.account?.id,
    // );
    // }
  }, [
    quoteAction,
    cleanQuoteInterval,
    // recoverQuoteInterval,
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
        swapSlippageRef.current,
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
        swapApprovingTransaction.blockNumber,
        undefined,
        ESwapQuoteKind.SELL,
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
      swapTabSwitchTypeRef.current === swapQuoteActionLockRef.current?.type &&
      swapQuoteActionLockRef.current?.actionLock &&
      swapQuoteActionLockRef.current?.fromTokenAmount ===
        fromAmountDebounce.value &&
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
    if (fromAmountDebounce.value && !fromAmountDebounce.isInput) {
      return;
    }
    alignmentDecimal();
    void quoteAction(
      swapSlippageRef.current,
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
      undefined,
      undefined,
      ESwapQuoteKind.SELL,
    );
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

  useEffect(() => {
    let kind = ESwapQuoteKind.SELL;
    if (swapTabSwitchType === ESwapTabSwitchType.LIMIT) {
      if (
        toAmountDebounceRef.current.isInput &&
        toAmountDebounceRef.current.value
      ) {
        kind = ESwapQuoteKind.BUY;
      }
    }
    alignmentDecimal();
    void quoteAction(
      swapSlippageRef.current,
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
      undefined,
      undefined,
      kind,
    );
  }, [alignmentDecimal, quoteAction, swapTabSwitchType]);

  useEffect(
    () => () => {
      cleanQuoteInterval();
    },
    [cleanQuoteInterval],
  );

  useEffect(() => {
    if (!isFocusRef.current) return;
    if (swapTabSwitchTypeRef.current !== ESwapTabSwitchType.LIMIT) {
      return;
    }
    if (!toAmountDebounce.isInput) {
      return;
    }
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
      swapTabSwitchTypeRef.current === swapQuoteActionLockRef.current?.type &&
      swapQuoteActionLockRef.current?.actionLock &&
      swapQuoteActionLockRef.current?.toTokenAmount ===
        toAmountDebounce.value &&
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
    alignmentToDecimal();
    void quoteAction(
      swapSlippageRef.current,
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
      undefined,
      undefined,
      ESwapQuoteKind.BUY,
    );
  }, [
    cleanQuoteInterval,
    quoteAction,
    swapAddressInfo.address,
    swapAddressInfo.networkId,
    fromToken?.networkId,
    fromToken?.contractAddress,
    toToken?.networkId,
    toToken?.contractAddress,
    alignmentToDecimal,
    toAmountDebounce,
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
      swapSlippageRef.current,
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
      undefined,
      undefined,
      ESwapQuoteKind.SELL,
    );
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
            (swapQuoteEventTotalCountRef.current.count > 0 &&
              swapQuoteResultListRef.current.length <
                swapQuoteEventTotalCountRef.current.count)
          ) {
            // reset tab quote data when swap modal is open and tab quote data is fetching
            closeQuoteEvent();
            setSwapQuoteEventTotalCount({
              count: 0,
            });
            setSwapQuoteResultList([]);
            setFromTokenAmount({ value: '', isInput: true });
          }
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        } else {
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
          appEventBus.on(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        }
      }
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
}
