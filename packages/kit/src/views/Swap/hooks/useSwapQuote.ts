import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

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
import {
  getSwapTokenIdentityKey,
  isSameSwapTokenIdentity,
} from '@onekeyhq/shared/src/utils/swapTokenIdentity';
import {
  EProtocolOfExchange,
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapSlippageSegmentKey,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';
import type {
  ISwapApproveTransaction,
  ISwapQuoteSessionEventV2,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { useDebounce } from '../../../hooks/useDebounce';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  useAccountSelectorStorageInitDoneAtom,
  useIsAccountSelectorActiveAccountInitDone,
} from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapApproveAllowanceSelectOpenAtom,
  useSwapFromTokenAmountAtom,
  useSwapInitialSelectedTokensSyncedAtom,
  useSwapLimitExpirationTimeAtom,
  useSwapLimitPartiallyFillAtom,
  useSwapLimitPriceUseRateAtom,
  useSwapManualSelectQuoteProvidersAtom,
  useSwapQuoteActionLockAtom,
  useSwapQuoteEventTotalCountAtom,
  useSwapQuoteFetchingAtom,
  useSwapQuoteListAtom,
  useSwapQuoteSessionStateAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectTokenNetworkAtom,
  useSwapShouldRefreshQuoteAtom,
  useSwapSlippageDialogOpeningAtom,
  useSwapStockExecutionTokenSyncIdAtom,
  useSwapToAnotherAccountAddressAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { isSwapAddressInfoReadyForOwner } from '../../../states/jotai/contexts/swap/addressInfoReadiness';
import { buildSwapManualProviderSelectionIntent } from '../../../states/jotai/contexts/swap/quoteProgress';
import {
  buildSwapQuoteLimitSemanticSettings,
  buildSwapQuoteSemanticIntent,
  getSwapQuoteKindForCurrentInput,
} from '../../../states/jotai/contexts/swap/quoteSemanticIntent';
import { isSwapQuoteSessionEventForCurrentSession } from '../../../states/jotai/contexts/swap/quoteSessionV2';
import { shouldPreserveSwapUserInputAmountOnAccountSwitch } from '../utils/swapColdStartTokenCacheUtils';
import { isSameSwapExecutionAddress } from '../utils/swapExecutionSnapshotGuard';
import { getSwapQuoteReadiness } from '../utils/swapQuoteReadiness';
import {
  getStockTradeAnalyticsPayload,
  getSwapAnalyticsCategory,
} from '../utils/swapStockAnalytics';
import { truncateDecimalPlaces } from '../utils/utils';

import { getSwapQuoteFocusLifecycleTransition } from './swapQuoteFocusLifecycle';
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
    quoteEventHandlerV2,
    syncNetworksSort,
    closeQuoteEvent,
    invalidateQuoteIntent,
    swapTypeSwitchAction,
  } = useSwapActions().current;
  const [swapQuoteActionLock] = useSwapQuoteActionLockAtom();
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const swapToAddressInfo = useSwapAddressInfo(ESwapDirectionType.TO);
  const [swapToAnotherAccountAddress] = useSwapToAnotherAccountAddressAtom();
  const [swapTabSwitchType] = useSwapTypeSwitchAtom();
  const [swapStockExecutionTokenSyncId] =
    useSwapStockExecutionTokenSyncIdAtom();
  const [swapFromToken, setSwapSelectFromToken] = useSwapSelectFromTokenAtom();
  const { slippageItem } = useSwapSlippagePercentageModeInfo();
  const [swapToToken, setSwapSelectToToken] = useSwapSelectToTokenAtom();
  const [currentSelectNetwork] = useSwapSelectTokenNetworkAtom();
  const [initialSelectedTokensSynced] =
    useSwapInitialSelectedTokensSyncedAtom();
  const [accountSelectorStorageInitDone] =
    useAccountSelectorStorageInitDoneAtom();
  const accountSelectorActiveAccountInitDone =
    useIsAccountSelectorActiveAccountInitDone(0);
  const isFromAddressInfoReady = isSwapAddressInfoReadyForOwner({
    address: swapAddressInfo.address,
    isAddressInfoReady: swapAddressInfo.isAddressInfoReady,
    owner: swapAddressInfo.accountInfo ?? swapAddressInfo.activeAccount,
  });
  const isToAddressInfoReady = isSwapAddressInfoReadyForOwner({
    address: swapToAddressInfo.address,
    isAddressInfoReady: swapToAddressInfo.isAddressInfoReady,
    owner: swapToAddressInfo.accountInfo ?? swapToAddressInfo.activeAccount,
  });
  const quoteReadiness = getSwapQuoteReadiness({
    networkSelectorReady: !currentSelectNetwork?.networkId,
    initialSelectedTokensSynced,
    accountSelectorStorageInitDone,
    accountSelectorActiveAccountInitDone,
    fromAddressInfoReady: isFromAddressInfoReady,
    toAddressInfoReady: isToAddressInfoReady,
  });
  const shouldPauseQuote = !quoteReadiness.ready;
  const shouldPauseQuoteRef = useRef(shouldPauseQuote);
  if (shouldPauseQuoteRef.current !== shouldPauseQuote) {
    shouldPauseQuoteRef.current = shouldPauseQuote;
  }
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
  const [swapLimitExpirationTime] = useSwapLimitExpirationTimeAtom();
  const [swapLimitPartiallyFill] = useSwapLimitPartiallyFillAtom();
  const [swapLimitPriceUseRate] = useSwapLimitPriceUseRateAtom();
  const [swapQuoteResultList] = useSwapQuoteListAtom();
  const [swapQuoteSessionState] = useSwapQuoteSessionStateAtom();
  const [, setSwapManualSelectQuoteProviders] =
    useSwapManualSelectQuoteProvidersAtom();
  const [swapQuoteEventTotalCount] = useSwapQuoteEventTotalCountAtom();
  const [swapQuoteFetching, setSwapQuoteFetching] = useSwapQuoteFetchingAtom();
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
  const swapToAddressInfoRef = useRef(swapToAddressInfo);
  const fromTokenAmountRef = useRef<{ value: string; isInput: boolean }>(
    fromTokenAmount,
  );
  const toTokenAmountRef = useRef<{ value: string; isInput: boolean }>(
    toTokenAmount,
  );

  const swapSlippageRef = useRef(slippageItem);
  const slippageKeyLastRef = useRef(slippageItem.key);
  const slippageCustomValueLastRef = useRef<number | undefined>(
    slippageItem.key === ESwapSlippageSegmentKey.CUSTOM
      ? slippageItem.value
      : undefined,
  );
  const fromTokenRef = useRef<ISwapToken | undefined>(fromToken);
  const toTokenRef = useRef<ISwapToken | undefined>(toToken);
  const shouldRefreshPreservedInputQuoteOnFocusRef = useRef(false);
  if (
    fromTokenAmountRef.current?.value !== fromTokenAmount.value ||
    fromTokenAmountRef.current?.isInput !== fromTokenAmount.isInput
  ) {
    fromTokenAmountRef.current = fromTokenAmount;
  }
  if (
    toTokenAmountRef.current?.value !== toTokenAmount.value ||
    toTokenAmountRef.current?.isInput !== toTokenAmount.isInput
  ) {
    toTokenAmountRef.current = toTokenAmount;
  }
  if (swapToAddressInfoRef.current !== swapToAddressInfo) {
    swapToAddressInfoRef.current = swapToAddressInfo;
  }
  if (swapTabSwitchTypeRef.current !== swapTabSwitchType) {
    swapTabSwitchTypeRef.current = swapTabSwitchType;
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
  const swapQuoteSessionStateRef = useRef(swapQuoteSessionState);
  if (swapQuoteSessionStateRef.current !== swapQuoteSessionState) {
    swapQuoteSessionStateRef.current = swapQuoteSessionState;
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
  const isModalPage = useIsOverlayPage();
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
  const shouldUseLeadingAmountDebounce =
    swapTabSwitchType !== ESwapTabSwitchType.STOCK;
  const fromAmountDebounce = useDebounce(fromTokenAmount, 500, {
    leading: shouldUseLeadingAmountDebounce,
  });

  const toAmountDebounce = useDebounce(toTokenAmount, 500, {
    leading: shouldUseLeadingAmountDebounce,
  });

  const isStockFromAmountDebouncing =
    swapTabSwitchType === ESwapTabSwitchType.STOCK &&
    fromTokenAmount.isInput &&
    Boolean(fromTokenAmount.value) &&
    fromTokenAmount.value !== fromAmountDebounce.value;

  const semanticIntent = useMemo(() => {
    const limitSettings = buildSwapQuoteLimitSemanticSettings({
      expirationTime: swapLimitExpirationTime.value,
      fromToken,
      limitPartiallyFillable: swapLimitPartiallyFill.value,
      limitPriceUseRate: swapLimitPriceUseRate,
      protocol: swapTabSwitchType,
      toToken,
    });
    return buildSwapQuoteSemanticIntent({
      accountId: swapAddressInfo.accountInfo?.account?.id,
      accountNetworkId: swapAddressInfo.networkId,
      fromAmount: fromTokenAmount,
      fromToken,
      limitSettings,
      protocol: swapTabSwitchType,
      receivingAddress: swapToAddressInfo.address,
      slippage: slippageItem,
      toAmount: toTokenAmount,
      toToken,
      userAddress: swapAddressInfo.address,
    });
  }, [
    fromToken,
    fromTokenAmount,
    slippageItem,
    swapAddressInfo.accountInfo?.account?.id,
    swapAddressInfo.address,
    swapAddressInfo.networkId,
    swapLimitExpirationTime.value,
    swapLimitPartiallyFill.value,
    swapLimitPriceUseRate,
    swapTabSwitchType,
    swapToAddressInfo.address,
    toToken,
    toTokenAmount,
  ]);
  const limitSettingsKeyDebounce = useDebounce(
    semanticIntent.limitSettingsKey,
    500,
    { leading: true },
  );
  const semanticIntentKeyRef = useRef(semanticIntent.key);
  const fromTokenIdentityKey = getSwapTokenIdentityKey(fromToken);
  const toTokenIdentityKey = getSwapTokenIdentityKey(toToken);
  const tokenPairIdentityKey = `${fromTokenIdentityKey}>${toTokenIdentityKey}`;
  const tokenPairIdentityKeyRef = useRef(tokenPairIdentityKey);

  useEffect(() => {
    // Root modals and the lock screen make route focus false while the Swap
    // tab and its in-flight V2 session are still alive. Keep the core session
    // handler mounted for the component lifetime so terminal events cannot be
    // lost; real tab exits explicitly invalidate and detach it below.
    appEventBus.off(EAppEventBusNames.SwapQuoteEventV2, quoteEventHandlerV2);
    appEventBus.on(EAppEventBusNames.SwapQuoteEventV2, quoteEventHandlerV2);
    return () => {
      appEventBus.off(EAppEventBusNames.SwapQuoteEventV2, quoteEventHandlerV2);
    };
  }, [quoteEventHandlerV2]);

  useLayoutEffect(() => {
    if (semanticIntentKeyRef.current === semanticIntent.key) {
      return;
    }
    const tokenPairChanged =
      tokenPairIdentityKeyRef.current !== tokenPairIdentityKey;
    semanticIntentKeyRef.current = semanticIntent.key;
    tokenPairIdentityKeyRef.current = tokenPairIdentityKey;
    if (tokenPairChanged) {
      setSwapManualSelectQuoteProviders(undefined);
    }
    invalidateQuoteIntent({ isPending: semanticIntent.hasValidInput });
    if (!isFocusRef.current && semanticIntent.hasValidInput) {
      shouldRefreshPreservedInputQuoteOnFocusRef.current = true;
    }
  }, [
    invalidateQuoteIntent,
    semanticIntent,
    setSwapManualSelectQuoteProviders,
    tokenPairIdentityKey,
  ]);

  useEffect(() => {
    if (shouldPauseQuote) {
      closeQuoteEvent();
    }
  }, [closeQuoteEvent, shouldPauseQuote]);

  useEffect(() => {
    if (swapTabSwitchType !== ESwapTabSwitchType.STOCK) {
      return;
    }
    if (isStockFromAmountDebouncing && !swapQuoteFetching) {
      setSwapQuoteFetching(true);
    }
    if (!fromTokenAmount.value && swapQuoteFetching) {
      setSwapQuoteFetching(false);
    }
  }, [
    fromTokenAmount.value,
    isStockFromAmountDebouncing,
    setSwapQuoteFetching,
    swapQuoteFetching,
    swapTabSwitchType,
  ]);

  useEffect(() => {
    if (swapTabSwitchType !== ESwapTabSwitchType.STOCK) {
      return;
    }
    if (!isFocused) {
      setSwapQuoteFetching(false);
      return;
    }
    return () => {
      setSwapQuoteFetching(false);
    };
  }, [isFocused, setSwapQuoteFetching, swapTabSwitchType]);

  const getCurrentQuoteKind = useCallback(
    () =>
      getSwapQuoteKindForCurrentInput({
        protocol: swapTabSwitchTypeRef.current,
        toAmount: toTokenAmountRef.current,
      }),
    [],
  );
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
    if (shouldPauseQuote) return;
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
  }, [fromTokenAmount, quoteAction, shouldPauseQuote]);

  useEffect(() => {
    if (!isFocusRef.current) return;
    if (shouldPauseQuote) return;
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
  }, [toTokenAmount, quoteAction, shouldPauseQuote]);

  useEffect(() => {
    if (!isFocusRef.current) {
      return;
    }
    if (shouldPauseQuote) {
      return;
    }
    if (
      !swapSlippageDialogOpening.status &&
      !swapApproveAllowanceSelectOpen &&
      swapSlippageDialogOpening.flag === 'save'
    ) {
      void quoteAction(
        swapSlippageRef.current,
        activeAccountRef.current?.address,
        activeAccountRef.current?.accountInfo?.account?.id,
        undefined,
        undefined,
        getCurrentQuoteKind(),
        undefined,
        swapToAddressInfoRef.current.address,
      );
    }
  }, [
    quoteAction,
    swapApproveAllowanceSelectOpen,
    swapSlippageDialogOpening,
    shouldPauseQuote,
    getCurrentQuoteKind,
  ]);

  // Re-quote when slippage is changed via the settings dialog (not via the main
  // slippage dialog which is handled by the flag === 'save' mechanism above).
  // Only re-quote on mode changes (AUTO <-> CUSTOM) or custom value changes.
  // Auto-suggested value changes in AUTO mode must NOT trigger re-quote (infinite loop).
  useEffect(() => {
    const prevKey = slippageKeyLastRef.current;
    const prevCustomValue = slippageCustomValueLastRef.current;

    // Always update refs so comparisons stay correct on next run
    slippageKeyLastRef.current = slippageItem.key;
    slippageCustomValueLastRef.current =
      slippageItem.key === ESwapSlippageSegmentKey.CUSTOM
        ? slippageItem.value
        : undefined;

    // Defer to the slippage dialog's close handler to avoid double re-quotes
    if (swapSlippageDialogOpening.status) {
      return;
    }

    if (!isFocusRef.current) {
      return;
    }

    const keyChanged = prevKey !== slippageItem.key;
    const customValueChanged =
      slippageItem.key === ESwapSlippageSegmentKey.CUSTOM &&
      prevCustomValue !== slippageItem.value;

    if (!keyChanged && !customValueChanged) {
      return;
    }
    if (shouldPauseQuote) {
      return;
    }

    void quoteAction(
      slippageItem,
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
      undefined,
      undefined,
      getCurrentQuoteKind(),
      undefined,
      swapToAddressInfoRef.current.address,
    );
  }, [
    slippageItem,
    swapSlippageDialogOpening.status,
    quoteAction,
    shouldPauseQuote,
    getCurrentQuoteKind,
  ]);

  useEffect(() => {
    if (shouldPauseQuote) {
      return;
    }
    if (!isFocusRef.current) {
      return;
    }
    if (
      fromToken?.networkId !== activeAccountRef.current?.networkId ||
      (fromTokenIdentityKey && fromTokenIdentityKey === toTokenIdentityKey)
    ) {
      return;
    }
    // fromToken & address change will trigger effect twice. so this use skip
    if (
      swapTabSwitchTypeRef.current === swapQuoteActionLockRef.current?.type &&
      swapQuoteActionLockRef.current?.actionLock &&
      swapQuoteActionLockRef.current?.fromTokenAmount ===
        fromAmountDebounce.value &&
      getSwapTokenIdentityKey(swapQuoteActionLockRef.current?.fromToken) ===
        fromTokenIdentityKey &&
      getSwapTokenIdentityKey(swapQuoteActionLockRef.current?.toToken) ===
        toTokenIdentityKey &&
      swapQuoteActionLockRef.current.accountId ===
        activeAccountRef.current?.accountInfo?.account?.id &&
      swapQuoteActionLockRef.current?.address === swapAddressInfo.address &&
      swapQuoteActionLockRef.current?.receivingAddress ===
        swapToAddressInfo.address &&
      (swapTabSwitchTypeRef.current !== ESwapTabSwitchType.LIMIT ||
        swapQuoteActionLockRef.current?.limitSettingsKey ===
          limitSettingsKeyDebounce)
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
    quoteAction,
    swapAddressInfo.address,
    swapAddressInfo.networkId,
    swapToAddressInfo.address,
    fromToken?.networkId,
    fromTokenIdentityKey,
    toTokenIdentityKey,
    swapStockExecutionTokenSyncId,
    alignmentDecimal,
    fromAmountDebounce,
    limitSettingsKeyDebounce,
    shouldPauseQuote,
  ]);

  useEffect(() => {
    if (!isFocusRef.current) {
      return;
    }
    if (shouldPauseQuote) {
      return;
    }
    void quoteAction(
      swapSlippageRef.current,
      activeAccountRef.current?.address,
      activeAccountRef.current?.accountInfo?.account?.id,
      undefined,
      undefined,
      getCurrentQuoteKind(),
      undefined,
      swapToAddressInfoRef.current.address,
    );
  }, [getCurrentQuoteKind, quoteAction, swapTabSwitchType, shouldPauseQuote]);

  useEffect(
    () => () => {
      closeQuoteEvent();
    },
    [closeQuoteEvent],
  );

  useEffect(() => {
    if (shouldPauseQuote) {
      return;
    }
    if (!isFocusRef.current) {
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
      (fromTokenIdentityKey && fromTokenIdentityKey === toTokenIdentityKey)
    ) {
      return;
    }
    // fromToken & address change will trigger effect twice. so this use skip
    if (
      swapTabSwitchTypeRef.current === swapQuoteActionLockRef.current?.type &&
      swapQuoteActionLockRef.current?.actionLock &&
      swapQuoteActionLockRef.current?.toTokenAmount ===
        toAmountDebounce.value &&
      getSwapTokenIdentityKey(swapQuoteActionLockRef.current?.fromToken) ===
        fromTokenIdentityKey &&
      getSwapTokenIdentityKey(swapQuoteActionLockRef.current?.toToken) ===
        toTokenIdentityKey &&
      swapQuoteActionLockRef.current.accountId ===
        activeAccountRef.current?.accountInfo?.account?.id &&
      swapQuoteActionLockRef.current?.address === swapAddressInfo.address &&
      swapQuoteActionLockRef.current?.receivingAddress ===
        swapToAddressInfo.address &&
      swapQuoteActionLockRef.current?.limitSettingsKey ===
        limitSettingsKeyDebounce
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
    quoteAction,
    swapAddressInfo.address,
    swapAddressInfo.networkId,
    swapToAddressInfo.address,
    fromToken?.networkId,
    fromTokenIdentityKey,
    toTokenIdentityKey,
    alignmentToDecimal,
    limitSettingsKeyDebounce,
    toAmountDebounce,
    shouldPauseQuote,
  ]);

  const swapApprovingSuccessAction = useCallback(
    async (data: {
      approvedSwapInfo: ISwapApproveTransaction;
      enableFilled?: boolean;
    }) => {
      if (swapShouldRefreshRef.current) {
        return;
      }
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
      const isCurrentApprovalOwner = () => {
        if (shouldPauseQuoteRef.current) {
          return false;
        }
        const currentSenderAddress = activeAccountRef.current?.address;
        return Boolean(
          approvedSwapInfo.useAddress &&
          currentSenderAddress &&
          isSameSwapExecutionAddress({
            networkId: fromTokenInfo.networkId,
            left: approvedSwapInfo.useAddress,
            right: currentSenderAddress,
          }),
        );
      };
      const setApprovedProvider = () => {
        setSwapManualSelectQuoteProviders(
          buildSwapManualProviderSelectionIntent({
            info: {
              provider: approvedSwapInfo.provider,
              providerName: approvedSwapInfo.providerName,
            },
          }),
        );
      };
      if (
        swapTabSwitchTypeRef.current === swapType &&
        isSameSwapTokenIdentity({
          token1: fromTokenInfo,
          token2: fromTokenRef.current,
        }) &&
        isSameSwapTokenIdentity({
          token1: toTokenInfo,
          token2: toTokenRef.current,
        }) &&
        amount === fromTokenAmountRef.current?.value &&
        isCurrentApprovalOwner()
      ) {
        setApprovedProvider();
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
        // Network sorting is asynchronous; re-read the live sender before
        // restoring a provider so an account switch cannot inherit it.
        if (isCurrentApprovalOwner()) {
          setApprovedProvider();
        }
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
      let finalMessage = errorMessage;
      if (!finalMessage && finalStatus !== ESwapEventAPIStatus.SUCCESS) {
        if (!providerQuoteResult?.length) {
          finalMessage = 'no provider result';
        } else {
          const failedProviders = providerQuoteResult.filter(
            (p) => !p.toAmount,
          );
          finalMessage = failedProviders
            .map((p) => `${p.providerName}: ${p.errorMessage ?? 'no quote'}`)
            .join('; ');
        }
      }
      let quoteProtocol: EProtocolOfExchange | undefined;
      if (swapTabSwitchTypeRef.current === ESwapTabSwitchType.LIMIT) {
        quoteProtocol = EProtocolOfExchange.LIMIT;
      } else if (swapTabSwitchTypeRef.current === ESwapTabSwitchType.STOCK) {
        quoteProtocol = EProtocolOfExchange.STOCK;
      }
      defaultLogger.swap.swapQuote.swapQuote({
        fromAddress: swapAddressInfo.address ?? '',
        toAddress: swapToAddressInfo.address ?? '',
        walletType: activeAccountRef.current?.accountInfo?.wallet?.type ?? '',
        quoteType: getSwapAnalyticsCategory({
          protocol: quoteProtocol,
          fromNetworkId: fromTokenRef.current?.networkId,
          toNetworkId: toTokenRef.current?.networkId,
        }),
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
        message: finalMessage,
        ...getStockTradeAnalyticsPayload({
          protocol: quoteProtocol,
          fromToken: fromTokenRef.current,
          toToken: toTokenRef.current,
        }),
      });
    },
    [swapAddressInfo.address, swapToAddressInfo.address],
  );

  const swapQuoteMixEvent = useCallback(
    async (event: ISwapQuoteSessionEventV2) => {
      if (
        event.kind === 'transportError' &&
        isSwapQuoteSessionEventForCurrentSession({
          event,
          state: swapQuoteSessionStateRef.current,
        })
      ) {
        swapQuoteMixEventAction(JSON.stringify(event.error));
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

  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (!isModalPage) {
        const shouldPreserveUserInputAmount =
          shouldPreserveSwapUserInputAmountOnAccountSwitch({
            fromTokenAmount: fromTokenAmountRef.current,
            toTokenAmount: toTokenAmountRef.current,
          });
        const focusTransition = getSwapQuoteFocusLifecycleTransition({
          hasPendingPreservedInputRefresh:
            shouldRefreshPreservedInputQuoteOnFocusRef.current,
          isHiddenByOverlay: isHiddenModel,
          isQuotePaused: shouldPauseQuoteRef.current,
          isTabFocused: isFocus,
          shouldPreserveUserInputOnExit: shouldPreserveUserInputAmount,
        });
        shouldRefreshPreservedInputQuoteOnFocusRef.current =
          focusTransition.nextShouldRefreshPreservedInput;

        if (focusTransition.shouldAttachSessionListeners) {
          // The tab-focus callback can run before the route-focus effect has
          // reattached its listener. Subscribe synchronously before a
          // preserved-input refresh can start emitting V2 events.
          appEventBus.off(
            EAppEventBusNames.SwapQuoteEventV2,
            quoteEventHandlerV2,
          );
          appEventBus.on(
            EAppEventBusNames.SwapQuoteEventV2,
            quoteEventHandlerV2,
          );
          appEventBus.off(
            EAppEventBusNames.SwapQuoteEventV2,
            swapQuoteMixEvent,
          );
          appEventBus.on(EAppEventBusNames.SwapQuoteEventV2, swapQuoteMixEvent);
          appEventBus.off(
            EAppEventBusNames.SwapApprovingSuccess,
            swapApprovingSuccessAction,
          );
          appEventBus.on(
            EAppEventBusNames.SwapApprovingSuccess,
            swapApprovingSuccessAction,
          );
          if (focusTransition.shouldRefreshPreservedInput) {
            void quoteAction(
              swapSlippageRef.current,
              activeAccountRef.current?.address,
              activeAccountRef.current?.accountInfo?.account?.id,
              undefined,
              undefined,
              getCurrentQuoteKind(),
              undefined,
              swapToAddressInfoRef.current.address,
            );
          }
        }
        if (focusTransition.shouldInvalidateIntent) {
          invalidateQuoteIntent({ isPending: false });
          if (focusTransition.shouldClearUserInput) {
            setFromTokenAmount({ value: '', isInput: true });
          }
        }
        if (focusTransition.shouldDetachSessionListeners) {
          appEventBus.off(
            EAppEventBusNames.SwapQuoteEventV2,
            quoteEventHandlerV2,
          );
          appEventBus.off(
            EAppEventBusNames.SwapQuoteEventV2,
            swapQuoteMixEvent,
          );
          appEventBus.off(
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
        appEventBus.off(EAppEventBusNames.SwapQuoteEventV2, swapQuoteMixEvent);
        appEventBus.on(EAppEventBusNames.SwapQuoteEventV2, swapQuoteMixEvent);
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
        appEventBus.off(EAppEventBusNames.SwapQuoteEventV2, swapQuoteMixEvent);
        appEventBus.off(
          EAppEventBusNames.SwapApprovingSuccess,
          swapApprovingSuccessAction,
        );
      }
    };
  }, [isFocused, isModalPage, swapApprovingSuccessAction, swapQuoteMixEvent]);
}
