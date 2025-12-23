import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIsOverlayPage } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  useSettingsAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ESwapEventAPIStatus } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee';
import type { ISwapQuoteProvideResult } from '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapQuote';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  IFetchQuotesParams,
  ISwapApproveTransaction,
  ISwapQuoteEvent,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { useDebounce } from '../../../hooks/useDebounce';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useSwapActions,
  useSwapApproveAllowanceSelectOpenAtom,
  useSwapFromTokenAmountAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapSlippageDialogOpeningAtom,
  useSwapToAnotherAccountAddressAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { truncateDecimalPlaces } from '../utils/utils';

import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapProInputToken, useSwapProToToken } from './useSwapPro';
import { useSwapSlippagePercentageModeInfo } from './useSwapState';

/**
 * React hook that manages fetching, updating, and synchronizing swap quotes for a decentralized exchange interface.
 *
 * This hook coordinates state and side effects related to swap quote retrieval, token and amount changes, slippage settings, and user interactions. It integrates with Jotai atoms, event bus listeners, and debounced input handling to ensure accurate and efficient quote updates. The hook also manages cleanup and event subscriptions based on tab focus and modal state.
 */
export function useSwapQuote() {
  const {
    quoteAction,
    cleanQuoteInterval,
    quoteEventHandler,
    syncNetworksSort,
    closeQuoteEvent,
    swapTypeSwitchAction,
  } = useSwapActions().current;
  const [swapQuoteActionLock] = useSwapQuoteActionLockAtom();
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [swapToAnotherAccountAddress] = useSwapToAnotherAccountAddressAtom();
  const [swapTabSwitchType] = useSwapTypeSwitchAtom();
  const [swapFromToken, setSwapSelectFromToken] = useSwapSelectFromTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [swapToToken, setSwapSelectToToken] = useSwapSelectToTokenAtom();
  const swapProInputToken = useSwapProInputToken();
  const swapProToToken = useSwapProToToken();
  const focusSwapPro = useMemo(() => {
    return (
      platformEnv.isNative && swapTabSwitchType === ESwapTabSwitchType.LIMIT
    );
  }, [swapTabSwitchType]);
  const fromToken = useMemo(() => {
    if (focusSwapPro) {
      return swapProInputToken;
    }
    return swapFromToken;
  }, [focusSwapPro, swapProInputToken, swapFromToken]);
  const toToken = useMemo(() => {
    if (focusSwapPro) {
      return swapProToToken;
    }
    return swapToToken;
  }, [focusSwapPro, swapProToToken, swapToToken]);
  const [swapSlippageDialogOpening] = useSwapSlippageDialogOpeningAtom();
  const [swapApproveAllowanceSelectOpen] =
    useSwapApproveAllowanceSelectOpenAtom();
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toTokenAmount, setToTokenAmount] = useSwapToTokenAmountAtom();
  const [swapQuoteResultList, setSwapQuoteResultList] = useSwapQuoteListAtom();
  const [, setSwapManualSelectQuoteProviders] =
    useSwapManualSelectQuoteProvidersAtom();
  const [swapQuoteEventTotalCount, setSwapQuoteEventTotalCount] =
    useSwapQuoteEventTotalCountAtom();
  const [swapQuoteFetching] = useSwapQuoteFetchingAtom();
  const [swapShouldRefresh] = useSwapShouldRefreshQuoteAtom();
  const [settingsAtom] = useSettingsAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();

  const settingsAtomRef = useRef(settingsAtom);
  if (settingsAtomRef.current !== settingsAtom) {
    settingsAtomRef.current = settingsAtom;
  }
  const settingsPersistAtomRef = useRef(settingsPersistAtom);
  if (settingsPersistAtomRef.current !== settingsPersistAtom) {
    settingsPersistAtomRef.current = settingsPersistAtom;
  }
  const swapTabSwitchTypeRef = useRef(swapTabSwitchType);
  const swapShouldRefreshRef = useRef(swapShouldRefresh);
  const swapQuoteActionLockRef = useRef(swapQuoteActionLock);
  const swapQuoteFetchingRef = useRef(swapQuoteFetching);
  const swapToAddressInfoRef = useRef(swapToAddressInfo);
  const fromTokenAmountRef = useRef<{ value: string; isInput: boolean }>(
    fromTokenAmount,
  );

  const swapSlippageRef = useRef(slippageItem);
  const fromTokenRef = useRef<ISwapToken | undefined>(fromToken);
  const toTokenRef = useRef<ISwapToken | undefined>(toToken);
  if (
    fromTokenAmountRef.current?.value !== fromTokenAmount.value ||
    fromTokenAmountRef.current?.isInput !== fromTokenAmount.isInput
  ) {
    fromTokenAmountRef.current = fromTokenAmount;
  }
  if (swapToAddressInfoRef.current !== swapToAddressInfo) {
    swapToAddressInfoRef.current = swapToAddressInfo;
  }
  if (swapTabSwitchTypeRef.current !== swapTabSwitchType) {
    swapTabSwitchTypeRef.current = swapTabSwitchType;
  }
  if (swapQuoteFetchingRef.current !== swapQuoteFetching) {
    swapQuoteFetchingRef.current = swapQuoteFetching;
  }
  const swapQuoteResultListRef = useRef(swapQuoteResultList);
  if (
    swapQuoteResultListRef.current?.length !== swapQuoteResultList?.length ||
    swapQuoteResultListRef.current?.some(
      (item, index) => item.quoteId !== swapQuoteResultList?.[index]?.quoteId,
    )
  ) {
    swapQuoteResultListRef.current = [...swapQuoteResultList];
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
  if (fromTokenRef.current !== fromToken) {
    fromTokenRef.current = fromToken;
  }
  if (toTokenRef.current !== toToken) {
    toTokenRef.current = toToken;
  }
  const isFocused = useIsFocused();
  const isFocusRef = useRef(isFocused);
  if (isFocusRef.current !== isFocused) {
    isFocusRef.current = isFocused;
  }
  const activeAccountRef = useRef<
    ReturnType<typeof useSwapAddressInfo> | undefined
  >(undefined);
  if (activeAccountRef.current !== swapAddressInfo) {
    activeAccountRef.current = swapAddressInfo;
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
        undefined,
        swapToAddressInfoRef.current.address,
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
        undefined,
        swapToAddressInfoRef.current.address,
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
        undefined,
        swapToAddressInfoRef.current.address,
      );
    }
  }, [
    quoteAction,
    cleanQuoteInterval,
    swapApproveAllowanceSelectOpen,
    swapSlippageDialogOpening,
  ]);

  useEffect(() => {
    if (
      !isFocusRef.current &&
      swapToAddressInfo.address ===
        swapQuoteActionLockRef.current?.receivingAddress
    ) {
      return;
    }
    if (
      !isFocusRef.current &&
      !swapToAnotherAccountAddress?.address &&
      settingsAtomRef.current.swapToAnotherAccountSwitchOn
    ) {
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
      swapQuoteActionLockRef.current?.address === swapAddressInfo.address &&
      swapQuoteActionLockRef.current?.receivingAddress ===
        swapToAddressInfo.address
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
      undefined,
      swapToAddressInfoRef.current.address,
    );
  }, [
    swapToAnotherAccountAddress?.address,
    cleanQuoteInterval,
    quoteAction,
    swapAddressInfo.address,
    swapAddressInfo.networkId,
    swapToAddressInfo.address,
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
    void quoteAction(
      swapSlippageRef.current,
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
      undefined,
      undefined,
      kind,
      undefined,
      swapToAddressInfoRef.current.address,
    );
  }, [quoteAction, swapTabSwitchType]);

  useEffect(
    () => () => {
      cleanQuoteInterval();
    },
    [cleanQuoteInterval],
  );

  useEffect(() => {
    if (
      !isFocusRef.current &&
      swapToAddressInfo.address ===
        swapQuoteActionLockRef.current?.receivingAddress
    ) {
      return;
    }
    if (
      !isFocusRef.current &&
      !swapToAnotherAccountAddress?.address &&
      settingsAtomRef.current.swapToAnotherAccountSwitchOn
    ) {
      return;
    }
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
      swapQuoteActionLockRef.current?.address === swapAddressInfo.address &&
      swapQuoteActionLockRef.current?.receivingAddress ===
        swapToAddressInfo.address
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
      undefined,
      swapToAddressInfoRef.current.address,
    );
  }, [
    swapToAnotherAccountAddress?.address,
    cleanQuoteInterval,
    quoteAction,
    swapAddressInfo.address,
    swapAddressInfo.networkId,
    swapToAddressInfo.address,
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
      undefined,
      swapToAddressInfoRef.current.address,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapAddressInfo.accountInfo?.deriveType]);

  const swapApprovingSuccessAction = useCallback(
    async (data: {
      approvedSwapInfo: ISwapApproveTransaction;
      enableFilled?: boolean;
    }) => {
      if (swapShouldRefreshRef.current) {
        return;
      }
      setSwapManualSelectQuoteProviders({
        protocol: data.approvedSwapInfo.protocol,
        quoteId: data.approvedSwapInfo?.quoteId,
        info: {
          provider: data.approvedSwapInfo.provider,
          providerName: data.approvedSwapInfo.providerName,
        },
        fromTokenInfo: {
          networkId: data.approvedSwapInfo.fromToken.networkId,
          contractAddress: data.approvedSwapInfo.fromToken.contractAddress,
          symbol: data.approvedSwapInfo.fromToken.symbol,
          decimals: data.approvedSwapInfo.fromToken.decimals,
        },
        toTokenInfo: {
          networkId: data.approvedSwapInfo.toToken.networkId,
          contractAddress: data.approvedSwapInfo.toToken.contractAddress,
          symbol: data.approvedSwapInfo.toToken.symbol,
          decimals: data.approvedSwapInfo.toToken.decimals,
        },
      });
      const { approvedSwapInfo, enableFilled } = data;
      const {
        fromToken: fromTokenInfo,
        toToken: toTokenInfo,
        amount,
        kind,
        toAmount,
        swapType,
        blockNumber,
      } = approvedSwapInfo;
      if (
        equalTokenNoCaseSensitive({
          token1: fromTokenInfo,
          token2: fromTokenRef.current,
        }) &&
        equalTokenNoCaseSensitive({
          token1: toTokenInfo,
          token2: toTokenRef.current,
        }) &&
        amount === fromTokenAmountRef.current?.value
      ) {
        void quoteAction(
          swapSlippageRef.current,
          activeAccountRef.current?.address,
          activeAccountRef.current?.accountInfo?.account?.id,
          blockNumber,
          undefined,
          kind ?? ESwapQuoteKind.SELL,
          undefined,
          swapToAddressInfoRef.current.address,
        );
      } else if (enableFilled) {
        if (swapTabSwitchTypeRef.current !== swapType) {
          await swapTypeSwitchAction(swapType);
        }
        setSwapSelectFromToken(fromTokenInfo);
        setSwapSelectToToken(toTokenInfo);
        await syncNetworksSort(fromTokenInfo.networkId);
        if (kind === ESwapQuoteKind.BUY && toAmount) {
          setToTokenAmount({ value: toAmount, isInput: true });
        } else {
          setFromTokenAmount({ value: amount, isInput: true });
        }
      }
    },
    [
      quoteAction,
      setSwapSelectFromToken,
      setSwapSelectToToken,
      setFromTokenAmount,
      setToTokenAmount,
      swapTypeSwitchAction,
      syncNetworksSort,
      setSwapManualSelectQuoteProviders,
    ],
  );

  const swapQuoteMixEventAction = useCallback(
    (errorMessage?: string) => {
      if (
        swapQuoteResultListRef.current?.length &&
        swapQuoteEventTotalCountRef.current.count > 0 &&
        swapQuoteResultListRef.current[0].eventId !==
          swapQuoteEventTotalCountRef.current.eventId
      ) {
        return;
      }
      const providerQuoteResult: ISwapQuoteProvideResult[] =
        swapQuoteResultListRef.current?.map((item) => {
          return {
            provider: item.info.provider,
            providerName: item.info.providerName,
            toAmount: item.toAmount,
            errorMessage: item.errorMessage,
          };
        });
      let finalStatus = errorMessage
        ? ESwapEventAPIStatus.FAIL
        : ESwapEventAPIStatus.SUCCESS;
      if (!providerQuoteResult?.length || providerQuoteResult.length === 0) {
        finalStatus = ESwapEventAPIStatus.FAIL;
      } else if (providerQuoteResult?.every((item) => !item.toAmount)) {
        finalStatus = ESwapEventAPIStatus.FAIL;
      } else if (providerQuoteResult?.some((item) => !item.toAmount)) {
        finalStatus = ESwapEventAPIStatus.PARTIAL_SUCCESS;
      }
      defaultLogger.swap.swapQuote.swapQuote({
        fromAddress: swapAddressInfo.address ?? '',
        toAddress: swapToAddressInfo.address ?? '',
        walletType: activeAccountRef.current?.accountInfo?.wallet?.type ?? '',
        quoteType: swapTabSwitchTypeRef.current,
        slippageSetting:
          settingsAtomRef.current.swapSlippagePercentageMode ===
          ESwapSlippageSegmentKey.AUTO
            ? 'auto'
            : 'custom',
        sourceChain: fromTokenRef.current?.networkId ?? '',
        receivedChain: toTokenRef.current?.networkId ?? '',
        sourceTokenSymbol: fromTokenRef.current?.symbol ?? '',
        receivedTokenSymbol: toTokenRef.current?.symbol ?? '',
        isAddReceiveAddress: settingsAtomRef.current.swapEnableRecipientAddress,
        isSmartMode: settingsPersistAtomRef.current.swapBatchApproveAndSwap,
        status: finalStatus,
        providerQuoteResult,
        message: errorMessage,
      });
    },
    [swapAddressInfo.address, swapToAddressInfo.address],
  );

  const swapQuoteMixEvent = useCallback(
    async (event: {
      event: ISwapQuoteEvent;
      type: 'done' | 'close' | 'error' | 'message' | 'open';
      params: IFetchQuotesParams;
      tokenPairs: { fromToken: ISwapToken; toToken: ISwapToken };
      accountId?: string;
    }) => {
      if (event?.type === 'error') {
        swapQuoteMixEventAction(JSON.stringify(event.event));
      }
    },
    [swapQuoteMixEventAction],
  );

  useEffect(() => {
    if (
      swapQuoteResultList?.length &&
      swapQuoteEventTotalCount?.count &&
      swapQuoteResultList?.length === swapQuoteEventTotalCount?.count &&
      swapQuoteEventTotalCount?.eventId
    ) {
      swapQuoteMixEventAction();
    } else if (
      swapQuoteEventTotalCount?.eventId &&
      swapQuoteEventTotalCount?.count === 0
    ) {
      swapQuoteMixEventAction('no provider support');
    }
  }, [
    swapQuoteResultList?.length,
    swapQuoteEventTotalCount?.count,
    swapQuoteEventTotalCount?.eventId,
    swapQuoteMixEventAction,
  ]);

  const isModalPage = useIsOverlayPage();
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (!isModalPage) {
        if (isFocus) {
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
          appEventBus.on(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, swapQuoteMixEvent);
          appEventBus.on(EAppEventBusNames.SwapQuoteEvent, swapQuoteMixEvent);
          appEventBus.off(
            EAppEventBusNames.SwapApprovingSuccess,
            swapApprovingSuccessAction,
          );
          appEventBus.on(
            EAppEventBusNames.SwapApprovingSuccess,
            swapApprovingSuccessAction,
          );
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
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, swapQuoteMixEvent);
          appEventBus.off(
            EAppEventBusNames.SwapApprovingSuccess,
            swapApprovingSuccessAction,
          );
        } else {
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
          appEventBus.on(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
          appEventBus.off(EAppEventBusNames.SwapQuoteEvent, swapQuoteMixEvent);
          appEventBus.on(EAppEventBusNames.SwapQuoteEvent, swapQuoteMixEvent);
          appEventBus.off(
            EAppEventBusNames.SwapApprovingSuccess,
            swapApprovingSuccessAction,
          );
          appEventBus.on(
            EAppEventBusNames.SwapApprovingSuccess,
            swapApprovingSuccessAction,
          );
        }
      }
    },
  );

  useEffect(() => {
    if (isModalPage) {
      if (isFocused) {
        appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        appEventBus.on(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        appEventBus.off(EAppEventBusNames.SwapQuoteEvent, swapQuoteMixEvent);
        appEventBus.on(EAppEventBusNames.SwapQuoteEvent, swapQuoteMixEvent);
        appEventBus.off(
          EAppEventBusNames.SwapApprovingSuccess,
          swapApprovingSuccessAction,
        );
        appEventBus.on(
          EAppEventBusNames.SwapApprovingSuccess,
          swapApprovingSuccessAction,
        );
      }
    }
    return () => {
      if (isModalPage) {
        appEventBus.off(EAppEventBusNames.SwapQuoteEvent, quoteEventHandler);
        appEventBus.off(EAppEventBusNames.SwapQuoteEvent, swapQuoteMixEvent);
        appEventBus.off(
          EAppEventBusNames.SwapApprovingSuccess,
          swapApprovingSuccessAction,
        );
      }
    };
  }, [
    isFocused,
    isModalPage,
    quoteEventHandler,
    swapApprovingSuccessAction,
    swapQuoteMixEvent,
  ]);
}
