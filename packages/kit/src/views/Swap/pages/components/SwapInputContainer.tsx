import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import {
  Dimensions,
  type StyleProp,
  TextInput,
  type TextStyle,
} from 'react-native';

import { XStack, YStack, getFontSize } from '@onekeyhq/components';
import type { IInputRef } from '@onekeyhq/components';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { useDebounce } from '@onekeyhq/kit/src/hooks/useDebounce';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  useRateDifferenceAtom,
  useSwapActions,
  useSwapAlertsAtom,
  useSwapBalanceDisplayCacheAtom,
  useSwapFromTokenAmountAtom,
  useSwapInitialSelectedTokensSyncedAtom,
  useSwapNetworksIncludeAllNetworkAtom,
  useSwapQuoteActionLockAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapSelectedTokenBalanceMetaAtom,
  useSwapSelectedTokensColdStartContextAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import {
  useCurrencyPersistAtom,
  useInAppNotificationAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isFoldableIPhone } from '@onekeyhq/shared/src/modules/DualScreenInfo/isFoldableIPhone';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { buildSwapSelectedTokensColdStartAccountKey } from '@onekeyhq/shared/src/utils/swapColdStartCacheSnapshotUtils';
import { checkWrappedTokenPair } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapQuoteKind,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { SwapRateDifferenceText } from '../../components/SwapRateDifferenceText';
import { getTokenIdentityKey } from '../../hooks/swapStockChannelUtils';
import { useSwapAddressInfo } from '../../hooks/useSwapAccount';
import {
  getSwapBalanceDisplayEntryFromGlobalSnapshot,
  useSwapColdStartDisplayTokens,
} from '../../hooks/useSwapColdStartDisplayTokens';
import { useSwapSelectedTokenInfo } from '../../hooks/useSwapTokens';
import { SwapTestIDs } from '../../testIDs';
import {
  getSwapDisplayAmount,
  getSwapRawInputAmount,
} from '../../utils/swapAmountUtils';
import { getSwapBalanceActionProps } from '../../utils/swapBalanceActionUtils';
import {
  resolveSwapBalanceDisplayAccountKey,
  resolveSwapBalanceDisplayCacheEntry,
  resolveSwapInputDisplayBalance,
} from '../../utils/swapBalanceDisplayCacheUtils';
import {
  buildSwapBalanceAccountIdentity,
  resolveVerifiedSwapBalance,
} from '../../utils/swapBalanceOwnerUtils';
import { isSwapBalanceLoadedZero } from '../../utils/swapDepositActionUtils';
import { getSwapTokenDisplayFiatValue } from '../../utils/swapDisplayFiatValue';

import SwapAccountAddressContainer from './SwapAccountAddressContainer';
import { SwapInitialSelectionTimeoutContext } from './SwapHistoryTradeAgainContext';
import SwapInputActions, {
  SWAP_PERCENTAGE_STAGE_IN_CARD_ON_NATIVE,
} from './SwapInputActions';

export { PercentageStageOnKeyboard } from '../../components/PercentageStageOnKeyboard';

// The pay card is where the user types, so it is the larger of the two: a
// taller input and a bigger amount. Around the input both cards share 68pt of
// chrome (30 label row, 6 margin, 32 footer), giving 162 against 108: 3:2.
const SWAP_FROM_AMOUNT_INPUT_HEIGHT = 94;
const SWAP_TO_AMOUNT_INPUT_HEIGHT = 40;

// The pay amount keeps one size however long it gets: an amount that changes
// size while it is typed is harder to read than one that scrolls. This size
// shows about nine characters beside the token selector on a 375pt phone,
// which covers the amounts the percentage stages fill in.
const SWAP_FROM_AMOUNT_FONT_SIZE_TOKEN = '$heading4xl';

// A foldable iPhone's folded screen is phone sized; a window whose shorter
// side reaches this is the unfolded inner screen, in either orientation.
const FOLDABLE_IPHONE_UNFOLDED_MIN_SHORT_SIDE = 600;

// Read when the page gains focus rather than subscribed to: folding the device
// while the page is open must not raise or dismiss the keyboard.
function isFoldableIPhoneUnfolded() {
  if (!isFoldableIPhone()) {
    return false;
  }
  const { width, height } = Dimensions.get('window');
  return Math.min(width, height) >= FOLDABLE_IPHONE_UNFOLDED_MIN_SHORT_SIDE;
}

// Lets the page transition settle before the keyboard is raised.
const SWAP_AMOUNT_AUTO_FOCUS_DELAY_MS = 350;

// The text field that holds the caret right now, if any.
function getFocusedTextInput(): unknown {
  if (platformEnv.isNative) {
    return TextInput.State.currentlyFocusedInput();
  }
  if (typeof document === 'undefined') {
    return null;
  }
  const element = document.activeElement;
  return element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
    ? element
    : null;
}

interface ISwapInputContainerProps {
  direction: ESwapDirectionType;
  token?: ISwapToken;
  onAmountChange?: (value: string) => void;
  amountValue: string;
  onSelectToken: (type: ESwapDirectionType) => void;
  balance: string;
  balanceLoading?: boolean;
  address?: string;
  inputLoading?: boolean;
  selectTokenLoading?: boolean;
  onBalanceMaxPress?: () => void;
  onSelectPercentageStage?: (stage: number) => void;
  // Focuses the amount input each time the page gains focus with no amount
  // entered yet, so the user can type without tapping the input first.
  autoFocusOnPageFocus?: boolean;
}

const SwapInputContainer = ({
  onAmountChange,
  direction,
  token,
  amountValue,
  selectTokenLoading,
  inputLoading,
  onSelectToken,
  onBalanceMaxPress,
  onSelectPercentageStage,
  balance,
  balanceLoading,
  autoFocusOnPageFocus,
}: ISwapInputContainerProps) => {
  useSwapSelectedTokenInfo({
    token,
    type: direction,
  });
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [alerts] = useSwapAlertsAtom();
  const swapAddressInfo = useSwapAddressInfo(direction);
  const { address, accountInfo, activeAccount } = swapAddressInfo;
  const [rateDifference] = useRateDifferenceAtom();
  const amountPrice = useMemo(() => {
    return getSwapTokenDisplayFiatValue({
      token,
      amount: amountValue ?? '',
      targetCurrency: settingsPersistAtom.currencyInfo.id,
      currencyMap,
    });
  }, [amountValue, currencyMap, settingsPersistAtom.currencyInfo.id, token]);

  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const [fromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromTokenBalance] = useSwapSelectedFromTokenBalanceAtom();
  const [swapSelectedTokenBalanceMeta] = useSwapSelectedTokenBalanceMetaAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [swapQuoteActionLock] = useSwapQuoteActionLockAtom();
  const [initialSelectedTokensSynced] =
    useSwapInitialSelectedTokensSyncedAtom();
  const [selectedTokensColdStartContext] =
    useSwapSelectedTokensColdStartContextAtom();
  const { fromTokenState, toTokenState } = useSwapColdStartDisplayTokens({
    allowInitialSelectionTimeout: useContext(
      SwapInitialSelectionTimeoutContext,
    ),
    fromToken,
    initialSelectedTokensSynced,
    swapType: swapTypeSwitch,
    toToken,
  });
  const tokenSelectionState =
    direction === ESwapDirectionType.FROM ? fromTokenState : toTokenState;
  const tokenSelectorDisplayToken =
    tokenSelectionState.status === 'ready'
      ? tokenSelectionState.token
      : undefined;
  const selectedTokenImageRecyclingKey = platformEnv.isDesktop
    ? getTokenIdentityKey(tokenSelectorDisplayToken) || undefined
    : undefined;
  const balanceDisplayToken = token?.symbol ? token : tokenSelectorDisplayToken;
  const [, setInAppNotification] = useInAppNotificationAtom();
  const [balanceDisplayCache] = useSwapBalanceDisplayCacheAtom();
  const currentBalanceDisplayAccountKey =
    buildSwapSelectedTokensColdStartAccountKey(activeAccount ?? accountInfo);
  const balanceDisplayAccountKey = resolveSwapBalanceDisplayAccountKey({
    currentAccountKey: currentBalanceDisplayAccountKey,
    cachedAccountKey: selectedTokensColdStartContext?.accountKey,
    cachedNetworkId: selectedTokensColdStartContext?.networkId,
    tokenNetworkId: balanceDisplayToken?.networkId,
  });
  const coldStartBalanceDisplayEntry = useMemo(
    () =>
      getSwapBalanceDisplayEntryFromGlobalSnapshot({
        accountAddress: address,
        currentAccountKey: currentBalanceDisplayAccountKey,
        token: balanceDisplayToken,
      }),
    [address, balanceDisplayToken, currentBalanceDisplayAccountKey],
  );
  const tokenSelectorMinWidth = platformEnv.isNative ? 112 : 132;
  const [swapSupportAllNetwork] = useSwapNetworksIncludeAllNetworkAtom();
  // The network badge on the token icon is the only place the card names the
  // network, so it falls back through every source that may know the logo.
  // A badge says nothing to a screen reader, so the name is resolved with it
  // and read out by the selector.
  const {
    logoURI: tokenSelectorNetworkLogoURI,
    name: tokenSelectorNetworkName,
  } = useMemo(() => {
    const networkId = tokenSelectorDisplayToken?.networkId;
    if (!networkId) {
      return {};
    }
    const swapNetwork = swapSupportAllNetwork.find(
      (net) => net.networkId === networkId,
    );
    const localNetwork = networkUtils.getLocalNetworkInfo(networkId);
    return {
      logoURI:
        swapNetwork?.logoURI ??
        tokenSelectorDisplayToken?.networkLogoURI ??
        localNetwork?.logoURI,
      name: swapNetwork?.name ?? localNetwork?.name,
    };
  }, [
    swapSupportAllNetwork,
    tokenSelectorDisplayToken?.networkId,
    tokenSelectorDisplayToken?.networkLogoURI,
  ]);
  const showTokenSelectorSkeleton =
    !tokenSelectorDisplayToken?.symbol &&
    (tokenSelectionState.status === 'loading' ||
      (selectTokenLoading && swapTypeSwitch !== ESwapTabSwitchType.SWAP));
  const handleSelectToken = useCallback(() => {
    onSelectToken(direction);
  }, [direction, onSelectToken]);
  const tokenSelectorTriggerProps = useMemo(
    () => ({
      testID:
        direction === ESwapDirectionType.FROM
          ? SwapTestIDs.fromTokenSelector
          : SwapTestIDs.toTokenSelector,
      minWidth: tokenSelectorMinWidth,
      justifyContent: 'flex-end' as const,
      // Matches the receive card's shorter input so the row stays compact.
      ...(direction === ESwapDirectionType.TO ? { py: '$1.5' as const } : {}),
      loading: showTokenSelectorSkeleton,
      selectedTokenImageUri: tokenSelectorDisplayToken?.logoURI,
      selectedTokenImageRecyclingKey,
      selectedNetworkImageUri: tokenSelectorNetworkLogoURI,
      selectedTokenSymbol: tokenSelectorDisplayToken?.symbol,
      // The same symbol can sit on two networks, and only the label can
      // tell a screen reader which one this is.
      ...(tokenSelectorDisplayToken?.symbol && tokenSelectorNetworkName
        ? {
            'aria-label': `${tokenSelectorDisplayToken.symbol}, ${tokenSelectorNetworkName}`,
          }
        : {}),
      onPress: handleSelectToken,
    }),
    [
      direction,
      handleSelectToken,
      selectedTokenImageRecyclingKey,
      showTokenSelectorSkeleton,
      tokenSelectorDisplayToken?.logoURI,
      tokenSelectorDisplayToken?.symbol,
      tokenSelectorMinWidth,
      tokenSelectorNetworkLogoURI,
      tokenSelectorNetworkName,
    ],
  );
  const displayBalance = useMemo(() => {
    const cachedBalance =
      resolveSwapBalanceDisplayCacheEntry({
        accountAddress: address,
        accountKey: balanceDisplayAccountKey,
        cache: balanceDisplayCache,
        token: balanceDisplayToken,
      })?.balance ?? coldStartBalanceDisplayEntry?.balance;
    const rawBalance = resolveSwapInputDisplayBalance({
      accountAddress: address,
      cachedBalance,
      selectedBalance: balance,
      tokenAccountAddress: token?.accountAddress,
      tokenBalance: token?.balanceParsed,
      tokenNetworkId: token?.networkId,
    });
    return rawBalance
      ? (getSwapDisplayAmount(
          rawBalance,
          balanceDisplayToken?.balanceMultiplier,
        ) ?? '')
      : rawBalance;
  }, [
    address,
    balance,
    balanceDisplayAccountKey,
    balanceDisplayCache,
    balanceDisplayToken,
    coldStartBalanceDisplayEntry?.balance,
    token,
  ]);
  const showBalanceSkeleton = useMemo(
    () =>
      Boolean(
        balanceDisplayToken &&
        address &&
        !displayBalance &&
        (balanceLoading || !balance),
      ),
    [address, balance, balanceDisplayToken, balanceLoading, displayBalance],
  );

  const fromInputHasError = useMemo(() => {
    const accountError =
      (alerts?.states.some((item) => item.inputShowError) &&
        direction === ESwapDirectionType.FROM) ||
      (!address &&
        (accountUtils.isHdWallet({ walletId: accountInfo?.wallet?.id }) ||
          accountUtils.isHwWallet({ walletId: accountInfo?.wallet?.id }) ||
          accountUtils.isQrWallet({ walletId: accountInfo?.wallet?.id })));
    const balanceBN = new BigNumber(fromTokenBalance ?? 0);
    const amountValueBN = new BigNumber(
      fromToken
        ? (getSwapRawInputAmount(fromTokenAmount.value, fromToken, 'down') ??
            'NaN')
        : '0',
    );
    const hasBalanceError =
      direction === ESwapDirectionType.FROM &&
      !!fromToken &&
      !!address &&
      balanceBN.lt(amountValueBN);
    return {
      accountError,
      hasBalanceError,
    };
  }, [
    alerts?.states,
    direction,
    address,
    accountInfo?.wallet?.id,
    fromTokenBalance,
    fromTokenAmount,
    fromToken,
  ]);
  const valueMoreComponent = useMemo(() => {
    if (
      rateDifference &&
      direction === ESwapDirectionType.TO &&
      swapTypeSwitch !== ESwapTabSwitchType.LIMIT
    ) {
      return (
        <SwapRateDifferenceText
          loading={inputLoading}
          rateDifference={rateDifference}
        />
      );
    }
    return null;
  }, [direction, inputLoading, rateDifference, swapTypeSwitch]);

  const [percentageInputStageShow, setPercentageInputStageShow] =
    useState(false);

  const amountInputRef = useRef<IInputRef>(null);
  const isRouteFocused = useRouteIsFocused();
  const hasAmountValueRef = useRef(!!amountValue);
  hasAmountValueRef.current = !!amountValue;
  useEffect(() => {
    // An amount already on screen means the user is reviewing a quote; raising
    // the keyboard then would cover it.
    if (!autoFocusOnPageFocus || !isRouteFocused || hasAmountValueRef.current) {
      return;
    }
    // The unfolded screen is short for its width, so the keyboard would cover
    // the action button as soon as the page opens.
    if (isFoldableIPhoneUnfolded()) {
      return;
    }
    const focusedInputAtStart = getFocusedTextInput();
    const timer = setTimeout(() => {
      // A preset amount (a jump from Market, a resumed approval) lands just
      // after the page opens, and the screen can be unfolded meanwhile, so
      // both are checked again when the delay ends.
      if (hasAmountValueRef.current || isFoldableIPhoneUnfolded()) {
        return;
      }
      // A field the user picked during the delay keeps the caret. A field
      // that was focused before the delay (a closing screen's search box) is
      // not the user's choice on this page, so it does not block the focus.
      const focusedInput = getFocusedTextInput();
      if (focusedInput && focusedInput !== focusedInputAtStart) {
        return;
      }
      amountInputRef.current?.focus();
    }, SWAP_AMOUNT_AUTO_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [autoFocusOnPageFocus, isRouteFocused]);

  const onFromInputFocus = () => {
    setPercentageInputStageShow(true);
    // The flag raises the percentage bar above the Android keyboard; with
    // the stages in the card there is no bar to raise.
    if (
      direction === ESwapDirectionType.FROM &&
      !SWAP_PERCENTAGE_STAGE_IN_CARD_ON_NATIVE
    ) {
      setInAppNotification((v) => ({
        ...v,
        swapPercentageInputStageShowForNative: true,
      }));
    }
  };

  const onFromInputBlur = () => {
    // delay to avoid blur when select percentage stage
    if (direction === ESwapDirectionType.FROM) {
      setInAppNotification((v) => ({
        ...v,
        swapPercentageInputStageShowForNative: false,
      }));
    }
    setTimeout(() => {
      setPercentageInputStageShow(false);
    }, 200);
  };

  const inputIsLoading = useMemo(() => {
    if (direction === ESwapDirectionType.TO) {
      return (
        inputLoading &&
        (!swapQuoteActionLock.kind ||
          swapQuoteActionLock.kind === ESwapQuoteKind.SELL)
      );
    }
    if (direction === ESwapDirectionType.FROM) {
      return inputLoading && swapQuoteActionLock.kind === ESwapQuoteKind.BUY;
    }
    return inputLoading;
  }, [direction, inputLoading, swapQuoteActionLock.kind]);

  const showPercentageInput = useMemo(
    () =>
      direction === ESwapDirectionType.FROM &&
      (percentageInputStageShow || !!amountValue),
    [direction, percentageInputStageShow, amountValue],
  );

  const showPercentageInputDebounce = useDebounce(showPercentageInput, 100, {
    leading: true,
  });

  // A loaded zero balance keeps the Top up chip visible (subdued, because the
  // action button already reads "Deposit to Trade") and turns Max into a
  // refresh action so the user can re-check the balance after depositing.
  // The balance atom holds '' until it loads and keeps its last value through
  // a same-token refresh, so the chip and the refresh control stay put while
  // it reloads. A fallback figure, or one still belonging to the previous
  // token or account, is not this row's zero, same as for the action button.
  const isFromBalanceLoadedZero = useMemo(
    () =>
      direction === ESwapDirectionType.FROM &&
      isSwapBalanceLoadedZero(
        resolveVerifiedSwapBalance({
          balance: fromTokenBalance,
          balanceMeta: swapSelectedTokenBalanceMeta.from,
          token: fromToken,
          accountAddress: address,
          accountIdentity: buildSwapBalanceAccountIdentity(activeAccount),
          isAddressInfoReady: swapAddressInfo.isAddressInfoReady,
        }),
      ),
    [
      address,
      activeAccount,
      direction,
      fromToken,
      fromTokenBalance,
      swapAddressInfo.isAddressInfoReady,
      swapSelectedTokenBalanceMeta.from,
    ],
  );
  const { loadSwapSelectTokenDetail } = useSwapActions().current;
  // Forced reload of this row's balance, used by the refresh control and when
  // the deposit modal closes.
  const refreshTokenBalance = useCallback(() => {
    void loadSwapSelectTokenDetail(direction, swapAddressInfo, true);
  }, [direction, loadSwapSelectTokenDetail, swapAddressInfo]);
  const balanceActionProps =
    direction === ESwapDirectionType.FROM
      ? getSwapBalanceActionProps({
          isLoadedZero: isFromBalanceLoadedZero,
          refreshing: !!balanceLoading,
          onRefresh: refreshTokenBalance,
          onMax: onBalanceMaxPress,
        })
      : undefined;

  const showActionBuy = useMemo(
    () =>
      direction === ESwapDirectionType.FROM &&
      !!accountInfo?.account?.id &&
      !!fromToken &&
      (fromInputHasError.hasBalanceError || isFromBalanceLoadedZero),
    [
      direction,
      accountInfo?.account?.id,
      fromToken,
      fromInputHasError,
      isFromBalanceLoadedZero,
    ],
  );
  const readOnly = useMemo(() => {
    if (direction === ESwapDirectionType.TO) {
      return (
        checkWrappedTokenPair({
          fromToken,
          toToken,
        }) || swapTypeSwitch !== ESwapTabSwitchType.LIMIT
      );
    }
    return false;
  }, [direction, swapTypeSwitch, fromToken, toToken]);
  // Subdued only while the receive amount is a computed result; in Limit mode
  // it is editable and must not look disabled.
  const amountInputColor =
    direction === ESwapDirectionType.TO && readOnly
      ? '$textSubdued'
      : undefined;
  return (
    <YStack borderRadius="$3" backgroundColor="$bgSubdued" borderWidth="$0">
      <XStack
        pt="$2.5"
        px="$3.5"
        alignItems="center"
        justifyContent="space-between"
      >
        <SwapAccountAddressContainer type={direction} />
        {direction === ESwapDirectionType.FROM ? (
          <SwapInputActions
            fromToken={fromToken}
            // Withheld while the cross-network account lookup is pending so
            // the chip cannot open Receive for the previous network's account;
            // a tap in that window resolves the account from activeAccount
            // instead.
            accountInfo={
              swapAddressInfo.isAddressInfoReady ? accountInfo : undefined
            }
            activeAccount={activeAccount}
            showPercentageInput={showPercentageInputDebounce}
            percentageInputOnNative={SWAP_PERCENTAGE_STAGE_IN_CARD_ON_NATIVE}
            showActionBuy={showActionBuy}
            actionBuyHighlighted={!isFromBalanceLoadedZero}
            onDepositClose={refreshTokenBalance}
            onSelectStage={onSelectPercentageStage}
          />
        ) : null}
      </XStack>
      <AmountInput
        borderRadius="$0"
        borderWidth="$0"
        onChange={onAmountChange}
        value={amountValue}
        hasError={
          fromInputHasError.accountError || fromInputHasError.hasBalanceError
        }
        balanceProps={{
          value: displayBalance,
          loading: showBalanceSkeleton,
          ...balanceActionProps,
        }}
        valueProps={{
          value: amountPrice,
          color:
            inputLoading && direction === ESwapDirectionType.TO
              ? '$textPlaceholder'
              : undefined,
          currency: settingsPersistAtom.currencyInfo.symbol,
          moreComponent: valueMoreComponent,
        }}
        inputProps={{
          ref: amountInputRef,
          // The receive amount is the quieter of the two: smaller, lighter and
          // subdued, so the amount the user types stays the focal point.
          ...(direction === ESwapDirectionType.FROM
            ? {
                height: SWAP_FROM_AMOUNT_INPUT_HEIGHT,
                fontSize: getFontSize(SWAP_FROM_AMOUNT_FONT_SIZE_TOKEN),
              }
            : {
                height: SWAP_TO_AMOUNT_INPUT_HEIGHT,
                fontSize: getFontSize('$heading2xl'),
                fontWeight: '500' as const,
              }),
          placeholder: '0.0',
          readonly: readOnly || inputIsLoading,
          color: inputIsLoading ? '$textPlaceholder' : amountInputColor,
          style:
            !platformEnv.isNative && readOnly
              ? ({
                  caretColor: 'transparent',
                } as unknown as StyleProp<TextStyle>)
              : undefined,
          autoCorrect: false,
          spellCheck: false,
          autoComplete: 'off',
          onFocus: onFromInputFocus,
          onBlur: onFromInputBlur,
          testID:
            direction === ESwapDirectionType.FROM
              ? SwapTestIDs.fromAmountInput
              : SwapTestIDs.toAmountInput,
        }}
        tokenSelectorTriggerProps={tokenSelectorTriggerProps}
        enableMaxAmount={!!(direction === ESwapDirectionType.FROM)}
      />
    </YStack>
  );
};

export default memo(SwapInputContainer);
