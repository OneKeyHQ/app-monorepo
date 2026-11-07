import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CommonActions,
  useNavigation,
  useNavigationState,
  useRoute,
} from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { AccessibilityInfo } from 'react-native';
import Animated, {
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  ActionList,
  Button,
  Icon,
  NavBackButton,
  NavCloseButton,
  Page,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  glassBarItem,
  usePreventRemove,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  NativeAmountKeypad,
  applyAmountKeypadKey,
} from '@onekeyhq/kit/src/components/NativeAmountKeypad';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { SendAutoSizeAmountInput } from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IOnramperLogContext } from '@onekeyhq/shared/src/logger/scopes/fiatCrypto/scenes/onramper';
import type {
  IOnramperButtonStyle,
  IOnramperEvent,
  IOnramperQuote,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalFiatCryptoParamList } from '@onekeyhq/shared/src/routes';
import { openFiatCryptoUrl } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EHeadlessBuyEntry } from '@onekeyhq/shared/types/fiatCrypto';
import type {
  IAddHeadlessBuyOrderParams,
  IHeadlessBuyAbandonReason,
} from '@onekeyhq/shared/types/fiatCrypto';

import { BuyActionZone } from '../../components/Headless/BuyActionZone';
import { CheckoutInfoCard } from '../../components/Headless/CheckoutInfoCard';
import {
  MOTION_BLOCK_ENTERING,
  MOTION_BLOCK_EXITING,
  MOTION_EASE_IN_OUT,
  MOTION_EASE_OUT,
  MOTION_EASE_PRESS,
  MOTION_ENTER_MS,
  MOTION_EXIT_MS,
  MOTION_MICRO_ENTERING,
  MOTION_MICRO_ENTERING_AFTER_EXIT,
  MOTION_MICRO_EXITING,
  MOTION_PRESS_MS,
} from '../../components/Headless/motionTokens';
import { PresetRow } from '../../components/Headless/PresetRow';
import { getProviderDisplayName } from '../../components/Headless/ProviderLogo';
import { EBuyActionState } from '../../components/Headless/types';
import { useOnramperCheckout } from '../../components/Headless/useOnramperCheckout';
import { useHeadlessBuyOrders } from '../../hooks/useHeadlessBuyOrders';

import type { RouteProp } from '@react-navigation/core';
import type { NativeStackHeaderItem } from '@react-navigation/native-stack';

// The SDK pay button is the screen's primary action, so it takes the primary
// button's colors — the same pill as "Review order" one step earlier: dark in
// light mode, light in dark mode (a dark pill on the dark page has no visible
// edge — Apple Pay's own guidance is black on light backgrounds, white on
// dark ones). The SDK wants literal colors, not theme tokens: these are
// $bgPrimary and $textInverse resolved per theme. borderRadius = half of the
// native button's 56pt min-height → fully rounded.
const HEADLESS_BUY_BUTTON_STYLES: Record<
  'light' | 'dark',
  IOnramperButtonStyle
> = {
  light: {
    backgroundColor: '#202020',
    foregroundColor: '#EFEFEF',
    borderRadius: 28,
  },
  dark: {
    backgroundColor: '#EEEEEE',
    foregroundColor: '#1E1E1E',
    borderRadius: 28,
  },
};

// Two-state screen: the amount block (big fiat figure + ≈crypto estimate)
// persists across both states, centered in the space the lower half leaves;
// 'input' shows a presets/preview-CTA slot + keypad (the slot morphs into the
// preview button once any amount exists), 'review' swaps that lower half for
// the order breakdown + pay button. Quoting runs from the first typed digit,
// so the estimate is live on the input screen.
type IBuyMode = 'input' | 'review';

// Amount-level quote failures return the user to the input screen (inline
// error under the amount) instead of offering an in-place retry.
const AMOUNT_ERROR_CODES = new Set(['amountOutOfRange', 'quoteUnavailable']);

// Mode-swap animation: the leaving lower block fades out fast (overlaid at
// its last position), the entering one fades in slower into the cleared
// space, and the amount block's layout
// transition glides it to its new centered position over the enter duration —
// reanimated coordinates all three, which moti's AnimatePresence did not (the
// hero snapped). Durations/easings come from the shared motion tokens.

function HeadlessBuyPage() {
  const route =
    useRoute<
      RouteProp<IModalFiatCryptoParamList, EModalFiatCryptoRoutes.HeadlessBuy>
    >();
  const { networkId, accountId, tokenAddress, token, entryFrom } = route.params;
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();
  const intl = useIntl();
  const themeVariant = useThemeVariant();

  const [amountText, setAmountText] = useState('');
  const [mode, setMode] = useState<IBuyMode>('input');
  // Hero layout transitions are armed shortly AFTER mount, not at mount: the
  // initial load performs multi-pass layout settling (native header height
  // lands after the first pass; the auto-size input re-renders after
  // measuring its width) and an always-on layout prop animates that settling
  // as a visible drift. The timer must also beat the first interaction: a
  // preset tap swaps to review in the same commit it sets the amount, and the
  // layout prop only animates changes committed AFTER it is attached.
  const [layoutAnimReady, setLayoutAnimReady] = useState(false);
  useEffect(() => {
    // Comfortably past the 1–2 frame settle, well under human reaction time.
    const timer = setTimeout(() => setLayoutAnimReady(true), 300);
    return () => clearTimeout(timer);
  }, []);
  // Pinned provider slug; undefined = let Onramper route to the best provider.
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(
    undefined,
  );

  const handleAmountChange = useCallback((value: string) => {
    // USD input → 2 decimal places.
    if (!validateAmountInput(value, 2)) {
      return;
    }
    setAmountText(value);
  }, []);

  // Dep-free functional updaters: the memoized keypad's cells sit on the
  // typing hot path and must not re-render per keystroke.
  const handleKeyPress = useCallback((key: string) => {
    setAmountText((prev) => {
      const next = applyAmountKeypadKey(prev, key);
      // USD input → 2 decimal places.
      return validateAmountInput(next, 2) ? next : prev;
    });
  }, []);

  const handleBackspaceLongPress = useCallback(() => {
    setAmountText('');
  }, []);

  const amount = Number(amountText) || 0;

  // Logging context comes from the checkout hook, which is declared further
  // down (it needs handleCompleted); the ref is assigned right after the hook.
  const getLogContextRef = useRef<() => IOnramperLogContext>(() => ({
    networkId,
    tokenSymbol: '',
    entryFrom,
  }));

  const enterReview = useCallback(() => {
    defaultLogger.fiatCrypto.onramper.reviewEntered({
      ...getLogContextRef.current(),
      amount,
      via: 'preview',
    });
    setMode('review');
  }, [amount]);

  // Preset tap = one-step buy entry: fill the amount AND jump straight to
  // review (the quote debounce runs there; the zone shows its quoting state
  // meanwhile).
  const handlePresetSelect = useCallback(
    (value: string) => {
      handleAmountChange(value);
      defaultLogger.fiatCrypto.onramper.reviewEntered({
        ...getLogContextRef.current(),
        amount: Number(value) || 0,
        via: 'preset',
      });
      setMode('review');
    },
    [handleAmountChange],
  );

  // Set right before an intentional close (completed checkout) so the
  // review-mode leave interception below lets that removal through.
  const allowLeaveRef = useRef(false);

  // Cleared on unmount so a checkout completion that resolves after the user
  // closed the modal does not navigate (see handleCompleted).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Resolve the route token from the network's buy list — only when the entry
  // passed just an address (the list fetch is wasted otherwise).
  const { result: buyTokens } = usePromiseResult(
    () =>
      token
        ? Promise.resolve(undefined)
        : backgroundApiProxy.serviceFiatCrypto.getTokensList({
            networkId,
            type: 'buy',
            accountId,
          }),
    [token, networkId, accountId],
  );
  const tokenFromList = useMemo(
    () =>
      buyTokens?.find(
        (o) => o.address.toLowerCase() === tokenAddress.toLowerCase(),
      ),
    [buyTokens, tokenAddress],
  );
  const activeToken = token ?? tokenFromList;

  // If a navigate() re-targets this mounted screen with different route params
  // (a second buy entry while the modal is open), drop the provider pin — its
  // coverage was scoped to the previous token.
  useEffect(() => {
    setSelectedProvider(undefined);
  }, [networkId, tokenAddress]);

  const enterLoggedRef = useRef(false);
  useEffect(() => {
    if (activeToken && !enterLoggedRef.current) {
      enterLoggedRef.current = true;
      defaultLogger.fiatCrypto.onramper.enterAmountPage({
        networkId,
        tokenSymbol: activeToken.symbol,
        entryFrom,
      });
    }
  }, [activeToken, networkId, entryFrom]);

  const { result: address } = usePromiseResult(
    async () => {
      if (!accountId) {
        return undefined;
      }
      return backgroundApiProxy.serviceAccount.getAccountAddressForApi({
        networkId,
        accountId,
      });
    },
    [accountId, networkId],
    // A navigate() re-target with a different account/network must not keep
    // quoting against the previous account's address while the new lookup is
    // in flight: clear it synchronously so the checkout hook holds Preparing
    // until the fresh address lands.
    { undefinedResultIfReRun: true },
  );

  // Shown before the address on the review card — the same lookup the order
  // record makes, so review and order detail name the account alike. Display
  // only: a failed lookup leaves the bare address.
  const { result: accountName } = usePromiseResult(async () => {
    if (!accountId) {
      return undefined;
    }
    return backgroundApiProxy.serviceAccount
      .getAccount({ accountId, networkId })
      .then((account) => account?.name)
      .catch(() => undefined);
  }, [accountId, networkId]);

  // Network display name for the review card's network row. Keyed on the
  // ROUTE id, not activeToken (the token is resolved by matching this very
  // network/address, so the values are identical — depending on activeToken
  // would just re-fire the fetch when the async list resolves).
  const { result: activeNetwork } = usePromiseResult(
    () => backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    [networkId],
  );

  // The address actually used for quoting; also shown on the review card so
  // the user can confirm the destination before paying.
  const effectiveAddress = address;

  // Reference-stable: this is a dependency of the hook's debounce effect.
  const onlyOnramps = useMemo(
    () => (selectedProvider ? [selectedProvider] : undefined),
    [selectedProvider],
  );

  // Latest quote for the completion handler — handleCompleted is a param of
  // the checkout hook, so it is defined before the hook returns `quote`;
  // the ref is assigned right after the hook call below.
  const quoteRef = useRef<IOnramperQuote | undefined>(undefined);

  // Snapshot of everything the order record needs. Read through a ref by the
  // dep-free SDK callbacks so a stale closure can never record stale figures.
  const buildOrderParams = (
    transactionId: string,
  ): IAddHeadlessBuyOrderParams => ({
    transactionId,
    accountId,
    networkId: activeToken?.networkId ?? networkId,
    address: effectiveAddress ?? '',
    tokenSymbol: activeToken?.symbol ?? '',
    tokenAddress: activeToken?.address ?? tokenAddress,
    tokenLogoURI: activeToken?.icon,
    fiatAmount: amount,
    fiatCurrency: 'usd',
    payout: quoteRef.current?.payout,
    networkFee: quoteRef.current?.networkFee,
    transactionFee: quoteRef.current?.transactionFee,
    providerName: selectedProvider ?? quoteRef.current?.ramp,
    entryFrom,
  });
  const buildOrderParamsRef = useRef(buildOrderParams);
  buildOrderParamsRef.current = buildOrderParams;

  // Order lifecycle → background store (product spec 2026-10-16): record on
  // the first transaction id (before Apple Pay), note payment authorization,
  // drop the hidden record on cancel / pre-payment failure (but keep it when
  // the provider failed with the payment outcome unknown, and show it as
  // failed when the provider's payment page said the authorization failed).
  const handleTransactionCreated = useCallback((transactionId: string) => {
    void backgroundApiProxy.serviceFiatCrypto.addHeadlessBuyOrder(
      buildOrderParamsRef.current(transactionId),
    );
  }, []);
  const handlePaymentAuthorized = useCallback((transactionId: string) => {
    void backgroundApiProxy.serviceFiatCrypto.markHeadlessBuyOrderPaymentSeen({
      transactionId,
    });
  }, []);
  const handleCheckoutAbandoned = useCallback(
    (transactionId: string, reason: IHeadlessBuyAbandonReason) => {
      void backgroundApiProxy.serviceFiatCrypto.discardHeadlessBuyOrder({
        transactionId,
        reason,
      });
    },
    [],
  );

  // Reached on `completed` and on SDK 1.3's `paymentPending` (accepted, not
  // settled): either way the order is submitted and tracked by status.
  const handleCompleted = useCallback(
    async (event: IOnramperEvent) => {
      // No id would mean an SDK older than 1.2.1; keep a local record anyway
      // so the user still gets an order page (status stays Processing).
      const transactionId = event.transactionId ?? `local-${Date.now()}`;
      // Awaited: the detail page reads the store the moment it mounts, and
      // when the pre-payment record never landed this call still has to build
      // and insert it — resetting onto the detail early shows "No results".
      try {
        await backgroundApiProxy.serviceFiatCrypto.markHeadlessBuyOrderSubmitted(
          {
            transactionId,
            order: buildOrderParamsRef.current(transactionId),
            // Both outcomes mean the provider accepted the payment: evidence
            // enough that the 24 h no-payment rule must never fail this
            // order (flows without a `paymentAuthorized` event included).
            paymentSeen: true,
          },
        );
      } catch (error) {
        // No record to open a detail for: keep the review card (the purchase
        // summary) on screen and surface the id so support can find the order.
        defaultLogger.fiatCrypto.onramper.orderSubmitFailed({
          transactionId,
          error: error instanceof Error ? error.message : String(error),
        });
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
          message: `${intl.formatMessage({
            id: ETranslations.buy_order_id__title,
          })}: ${transactionId}`,
        });
        return;
      }
      // The write above is a background round trip; in review the leave guard
      // only returns to input, so a second close during that window dismisses
      // the modal. The order is stored and reachable from the orders entry —
      // resetting now would replace whatever screen the user moved on to.
      if (!isMountedRef.current || !reactNavigation.isFocused()) {
        defaultLogger.fiatCrypto.onramper.orderDetailSkipped({ transactionId });
        return;
      }
      // Bypass the review leave guard first: the reset below removes this
      // screen and fires beforeRemove. Then WIPE the buy flow from the modal
      // stack instead of pushing — the native pay button is consumed, so
      // back must not be able to reach it; the order detail becomes the only
      // route in the stack.
      allowLeaveRef.current = true;
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: EModalFiatCryptoRoutes.HeadlessBuyOrderDetail,
              params: { transactionId, fromCheckout: true },
            },
          ],
        }),
      );
    },
    [navigation, reactNavigation, intl],
  );

  const {
    actionState,
    nativeButton,
    quote,
    isMock,
    errorMessage,
    errorCode,
    unknownOutcomeTransactionId,
    payMock,
    retry,
    canRetryInit,
    retryInit,
    isTakingLong,
    refreshQuote,
    canSignOut,
    signOut,
    getLogContext,
  } = useOnramperCheckout({
    amount,
    // Quote from the first digit — the ≈crypto estimate is live while typing.
    isAmountValid: amount > 0 && Boolean(activeToken),
    source: 'usd',
    // Onramper's own asset id (e.g. 'usdt_ethereum', server-delivered on the
    // buy list): a bare symbol is ambiguous across networks and can quote a
    // different asset. The symbol fallback only serves direct navigations
    // without the server fields (e.g. Gallery / mock).
    destination:
      activeToken?.onramperId ?? activeToken?.symbol?.toLowerCase() ?? '',
    tokenSymbol: activeToken?.symbol,
    // Onramper speaks its own network slugs (e.g. 'ethereum'), not OneKey ids.
    // The entry gate requires the server-delivered slug (OK-58060), so this
    // only misses for direct navigations (e.g. Gallery) — '' fails the quote
    // cleanly rather than sending a raw OneKey id as a slug.
    network: activeToken?.onramperNetworkCode ?? '',
    address: effectiveAddress,
    // No `country`: Onramper geo-detects from the device IP, which is also
    // what providers enforce at checkout (country == device IP ==
    // verified-phone country) — staging tests must run behind a US/EU VPN.
    onlyOnramps,
    buttonStyle: HEADLESS_BUY_BUTTON_STYLES[themeVariant],
    entryFrom,
    onCompleted: handleCompleted,
    onTransactionCreated: handleTransactionCreated,
    onPaymentAuthorized: handlePaymentAuthorized,
    onCheckoutAbandoned: handleCheckoutAbandoned,
  });
  quoteRef.current = quote;
  getLogContextRef.current = getLogContext;

  const openWebFallback = useCallback(async () => {
    const { url } =
      await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
        networkId,
        tokenAddress: activeToken?.address ?? tokenAddress,
        accountId,
        // This page is buy-only (sell always stays on the web widget).
        type: 'buy',
      });
    defaultLogger.fiatCrypto.onramper.webFallbackPressed({
      ...getLogContext(),
      errorCode,
      hasUrl: Boolean(url),
    });
    if (url) {
      openFiatCryptoUrl(url);
    }
  }, [
    networkId,
    activeToken?.address,
    tokenAddress,
    accountId,
    getLogContext,
    errorCode,
  ]);

  // Leaving review abandons the mounted native pay button: the SDK's prepared
  // intents are single-mount, so remounting the same element on a later entry
  // renders blank. Re-quote on exit so the next entry gets a fresh button.
  const exitReview = useCallback(() => {
    defaultLogger.fiatCrypto.onramper.reviewExited({
      ...getLogContext(),
      amount,
      actionState,
    });
    setMode('input');
    refreshQuote();
  }, [refreshQuote, getLogContext, amount, actionState]);

  // In review, every page-leave intent returns to the input view instead of
  // closing the modal. The header's own button already does (it becomes a
  // back arrow in review, below); this catches the ones a header can't —
  // Android back, the iOS swipe-down. usePreventRemove (NOT a raw
  // beforeRemove preventDefault): it registers the prevented state with the
  // native stack so gesture-driven dismissals are blocked up front —
  // cancelling a native gesture after the fact leaves native and JS
  // navigation state out of sync and has frozen the app on close
  // (intermittent hard-hang, device-observed).
  usePreventRemove(mode === 'review', ({ data }) => {
    if (allowLeaveRef.current) {
      // Completed checkout: let the blocked action (the success-page reset)
      // through.
      reactNavigation.dispatch(data.action);
      return;
    }
    exitReview();
  });

  // The header's left button says what it does. Input: the navigator's own
  // button — close at the root of the modal, back when pushed from the buy
  // list — restated here because header options merge, so whatever review
  // set would otherwise stay. Review: a back arrow, because it returns to the
  // amount (exitReview) rather than closing the page.
  const isStackRoot = useNavigationState(
    (state) => state.routes[0]?.key === route.key,
  );
  const goBack = useCallback(() => {
    reactNavigation.goBack();
  }, [reactNavigation]);
  const backLabel = intl.formatMessage({ id: ETranslations.global_back });
  const closeLabel = intl.formatMessage({ id: ETranslations.global_close });
  const showBackButton = mode === 'review' || !isStackRoot;
  const handleBackPress = mode === 'review' ? exitReview : goBack;
  const buildIOS26HeaderLeftItems = useCallback(
    (): NativeStackHeaderItem[] => [
      showBackButton
        ? // The system back glyph, as on every pushed iOS 26 screen.
          {
            type: 'button',
            label: backLabel,
            accessibilityLabel: backLabel,
            icon: { type: 'sfSymbol', name: 'chevron.backward' },
            identifier: 'headless-buy-back',
            onPress: handleBackPress,
          }
        : // Same item the navigator puts on a modal root.
          glassBarItem(
            <NavCloseButton aria-label={closeLabel} onPress={goBack} />,
          ),
    ],
    [showBackButton, backLabel, closeLabel, handleBackPress, goBack],
  );
  const renderHeaderLeft = useCallback(
    () =>
      showBackButton ? (
        <NavBackButton aria-label={backLabel} onPress={handleBackPress} />
      ) : (
        <NavCloseButton aria-label={closeLabel} onPress={goBack} />
      ),
    [showBackButton, backLabel, closeLabel, handleBackPress, goBack],
  );
  let headerLeftOptions: {
    headerLeft?: typeof renderHeaderLeft;
    unstable_headerLeftItems?: typeof buildIOS26HeaderLeftItems;
  };
  if (platformEnv.isNativeIOS26Plus) {
    headerLeftOptions = { unstable_headerLeftItems: buildIOS26HeaderLeftItems };
  } else if (platformEnv.isNativeIOS || mode === 'review') {
    headerLeftOptions = { headerLeft: renderHeaderLeft };
  } else {
    // The JS header draws the navigator's own button when none is given.
    headerLeftOptions = { headerLeft: undefined };
  }

  // Amount-level failures are fixed on the input screen, not retried in place.
  // The quote error stays visible under the amount (heroError below) until the
  // next edit re-quotes; while it is showing, "Preview order" is disabled —
  // otherwise the effect below would bounce the tap straight back to input
  // (a one-frame flash that reads as a dead button).
  const hasAmountError =
    actionState === EBuyActionState.RetryableError &&
    errorCode !== undefined &&
    AMOUNT_ERROR_CODES.has(errorCode);
  useEffect(() => {
    if (mode === 'review' && hasAmountError) {
      setMode('input');
    }
  }, [mode, hasAmountError]);

  // Under the amount only while the amount is where it gets fixed: on the
  // input screen (quoting is live there) and for amount-level failures. In
  // review every other failure sits right above the action that answers it
  // (BuyActionZone), not at the top of the page, far from it.
  const heroError =
    actionState === EBuyActionState.RetryableError &&
    (mode === 'input' || hasAmountError)
      ? errorMessage
      : undefined;
  // What the page shows of a failure, wherever it shows it: the hero line
  // above, or the action zone in review (retryable and web-fallback states).
  const visibleError =
    heroError ??
    (mode === 'review' &&
    (actionState === EBuyActionState.RetryableError ||
      actionState === EBuyActionState.WebFallback)
      ? errorMessage
      : undefined);
  // Status lines are read out as they appear: they change without any
  // action of the user's, so a screen-reader user would otherwise never
  // learn that the quote failed or is still coming.
  useEffect(() => {
    if (visibleError) {
      AccessibilityInfo.announceForAccessibility(visibleError);
    }
  }, [visibleError]);

  const heroLayout = layoutAnimReady
    ? LinearTransition.duration(MOTION_ENTER_MS).easing(MOTION_EASE_IN_OUT)
    : undefined;

  // In review the amount is a way back to editing it: pressing it presses
  // the number itself in a little (the overlay below has no fill of its own).
  const amountPressed = useSharedValue(false);
  const amountPressStyle = useAnimatedStyle(() => ({
    transform: [
      {
        // Asymmetric: the press-in is the user's, the snap-back the
        // system's — and short, so it is done before the release's mode
        // swap glides the amount away.
        scale: amountPressed.value
          ? withTiming(0.97, {
              duration: MOTION_PRESS_MS,
              easing: MOTION_EASE_PRESS,
            })
          : withTiming(1, {
              duration: MOTION_EXIT_MS,
              easing: MOTION_EASE_OUT,
            }),
      },
    ],
  }));
  const handleAmountPressIn = useCallback(() => {
    amountPressed.value = true;
  }, [amountPressed]);
  const handleAmountPressOut = useCallback(() => {
    amountPressed.value = false;
  }, [amountPressed]);
  // The overlay unmounts with review: a press it never saw end (e.g. an
  // amount error sending the page back to input) must not leave the amount
  // pressed in.
  useEffect(() => {
    if (mode !== 'review') {
      amountPressed.value = false;
    }
  }, [mode, amountPressed]);

  // Same-token order still processing (direct entries skip the Buy tab's
  // banner, and this is where a repeat purchase is most likely). Shown in the
  // error line below the amount; a live quote error takes priority.
  const { processingOrders } = useHeadlessBuyOrders({
    // The Buy tab just refreshed on its own mount; direct entries have not.
    refreshOnMount: entryFrom !== EHeadlessBuyEntry.BuyTokenList,
  });
  const sameTokenOrder = useMemo(() => {
    const tokenNetworkId = activeToken?.networkId ?? networkId;
    const addr = (activeToken?.address ?? tokenAddress).toLowerCase();
    return processingOrders.find(
      (o) =>
        o.networkId === tokenNetworkId && o.tokenAddress.toLowerCase() === addr,
    );
  }, [
    processingOrders,
    activeToken?.networkId,
    activeToken?.address,
    networkId,
    tokenAddress,
  ]);
  const openSameTokenOrder = useCallback(() => {
    if (!sameTokenOrder) {
      return;
    }
    defaultLogger.fiatCrypto.onramper.ordersEntryPressed({
      source: 'reminder',
      processingCount: processingOrders.length,
    });
    navigation.push(EModalFiatCryptoRoutes.HeadlessBuyOrderDetail, {
      transactionId: sameTokenOrder.transactionId,
    });
  }, [sameTokenOrder, processingOrders.length, navigation]);
  // The checkout failed with the payment outcome unknown: the action zone
  // opens that order instead of offering a one-tap retry.
  const openUnknownOutcomeOrder = useCallback(() => {
    if (!unknownOutcomeTransactionId) {
      return;
    }
    defaultLogger.fiatCrypto.onramper.ordersEntryPressed({
      source: 'paymentUnknown',
      processingCount: processingOrders.length,
    });
    navigation.push(EModalFiatCryptoRoutes.HeadlessBuyOrderDetail, {
      transactionId: unknownOutcomeTransactionId,
    });
  }, [unknownOutcomeTransactionId, processingOrders.length, navigation]);

  // The ≈crypto line under the amount: live payout from the quote, a skeleton
  // while a quote is in flight (avoids showing a stale figure for the newly
  // typed amount), and a plain 0 when there is nothing to quote.
  const isQuoting =
    amount > 0 &&
    (actionState === EBuyActionState.Preparing ||
      actionState === EBuyActionState.Refreshing);
  const estimateValueProps = useMemo(
    () => ({
      // The hook keeps the last successful quote; with the amount cleared that
      // figure is stale, so the estimate falls back to 0 immediately.
      value:
        amount > 0 && quote?.payout !== undefined ? String(quote.payout) : '0',
      tokenSymbol: activeToken?.symbol,
      formatter: 'balance' as const,
      // Regular body type — the estimate is secondary to the amount above it.
      size: '$bodyLg' as const,
      loading: isQuoting,
    }),
    [amount, quote?.payout, activeToken?.symbol, isQuoting],
  );

  // Switchable providers: the current quote's ramp plus the SDK's recommended
  // alternatives. TODO(onramper): confirm `recommendations` carries provider
  // slugs / ask for a dedicated provider-list endpoint for the headless flow.
  const providerOptions = useMemo(() => {
    const slugs = new Set<string>();
    if (quote?.ramp) {
      slugs.add(quote.ramp);
    }
    (quote?.recommendations ?? []).forEach((slug) => slugs.add(slug));
    if (selectedProvider) {
      slugs.add(selectedProvider);
    }
    return Array.from(slugs);
  }, [quote, selectedProvider]);
  // Offer switching when there is a real alternative, or a pin to undo.
  const canSwitchProvider =
    providerOptions.length > 1 || Boolean(selectedProvider);

  const handleSelectProvider = useCallback(() => {
    const pickProvider = (slug: string | undefined) => {
      defaultLogger.fiatCrypto.onramper.providerSelected({
        ...getLogContext(),
        from: selectedProvider,
        to: slug,
      });
      setSelectedProvider(slug);
    };
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.provider_title }),
      sections: [
        {
          items: [
            {
              label: intl.formatMessage({
                id: ETranslations.buy_provider_auto__title,
              }),
              onPress: () => pickProvider(undefined),
            },
            ...providerOptions.map((slug) => ({
              label: getProviderDisplayName(slug),
              onPress: () => pickProvider(slug),
            })),
          ],
        },
      ],
    });
  }, [providerOptions, selectedProvider, getLogContext, intl]);

  // Drops the stored OnramperID login so the next checkout re-runs email +
  // phone verification (the hook re-quotes, so a fresh pay button follows).
  // User-facing on all builds: the SDK keeps the OIDC login in native storage
  // and offers no in-flow way to switch accounts — without this, a user whose
  // OnramperID cannot transact (e.g. KYC country vs current region mismatch)
  // is stuck with no way to try another account. Offered from the failure
  // states only, and only while there may be a login to drop (canSignOut).
  // One sign-out at a time: a second tap while the first is in flight would
  // sign out and re-quote twice and stack two toasts (one may even report a
  // failure). The button also shows a spinner until this settles
  // (onPressLoadingEnabled in BuyActionZone); the ref closes the window
  // before that re-render lands.
  const switchingAccountRef = useRef(false);
  const handleSwitchAccount = useCallback(async () => {
    if (switchingAccountRef.current) {
      return;
    }
    switchingAccountRef.current = true;
    try {
      await signOut().then(
        () => {
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.logged_out_feedback,
            }),
            message: intl.formatMessage({
              id: ETranslations.buy_onramper_signed_out__msg,
            }),
          });
        },
        () => {
          // Already logged by the hook (signOutFailed).
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
          });
        },
      );
    } finally {
      switchingAccountRef.current = false;
    }
  }, [signOut, intl]);

  // The init or the quote has kept the user waiting (the hook's
  // isTakingLong): entering the page to a first quote takes 7-16 s on device,
  // most of it session + SDK init. Yields to a quote error.
  const slowWaitText =
    !heroError && isTakingLong
      ? intl.formatMessage({ id: ETranslations.buy_quote_slow__msg })
      : undefined;
  useEffect(() => {
    if (slowWaitText) {
      AccessibilityInfo.announceForAccessibility(slowWaitText);
    }
  }, [slowWaitText]);

  // The one line under the amount. A quote error comes first; then the slow
  // wait, which only lasts until the pending answer lands; then the reminder
  // of a same-token order, which matters once there is something to pay.
  // Each kind fades out, then the next fades in, in place (keyed by kind
  // below); the slot is fixed-height, so a swap never moves the amount.
  let heroNoticeKind: 'error' | 'slow' | 'reminder' | undefined;
  let heroNotice: ReactNode = null;
  if (heroError) {
    heroNoticeKind = 'error';
    heroNotice = (
      <SizableText
        size="$bodySm"
        color="$textCritical"
        textAlign="center"
        numberOfLines={2}
      >
        {heroError}
      </SizableText>
    );
  } else if (slowWaitText) {
    heroNoticeKind = 'slow';
    heroNotice = (
      <SizableText
        testID="headless-buy-slow-wait"
        size="$bodySm"
        color="$textSubdued"
        textAlign="center"
        numberOfLines={2}
      >
        {slowWaitText}
      </SizableText>
    );
  } else if (sameTokenOrder) {
    heroNoticeKind = 'reminder';
    heroNotice = (
      <XStack
        testID="headless-buy-order-reminder"
        ai="center"
        jc="center"
        gap="$1"
        role="button"
        onPress={openSameTokenOrder}
        // One 16pt text line → a 44pt target; the slot only holds this line,
        // and nothing above or below it is pressable.
        hitSlop={{ top: 14, bottom: 14 }}
        cursor="pointer"
        pressStyle={{ opacity: 0.6 }}
      >
        <Stack w="$1.5" h="$1.5" borderRadius="$full" bg="$iconInfo" />
        <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
          {intl.formatMessage({
            id: ETranslations.buy_order_in_progress_same_token__msg,
          })}
        </SizableText>
        {/* The small chevron's glyph leaves ~6pt of empty box on its right;
            cancelling it keeps the centered line optically centered. */}
        <Icon
          name="ChevronRightSmallOutline"
          size="$4"
          color="$iconSubdued"
          mr="$-1.5"
        />
      </XStack>
    );
  }

  return (
    <Page>
      <Page.Header
        title={
          activeToken?.symbol
            ? intl.formatMessage(
                { id: ETranslations.dexmarket_buy_token_default },
                { TokenName: activeToken.symbol },
              )
            : intl.formatMessage({ id: ETranslations.global_buy })
        }
        {...headerLeftOptions}
      />
      <Page.Body>
        <YStack flex={1} px="$5" pb="$3">
          {/* The amount block persists across both modes and re-centers in
              whatever vertical space the lower half leaves; the layout
              transition animates that movement. */}
          {/* The layout transition lives ONLY on the inner content wrapper:
              the outer flex container is invisible, so animating its frame
              adds nothing visually — but on Fabric a layout-animated height
              goes through shadow-tree updates and can perturb the SIBLING
              block below mid-transition (the bottom button jolted). The
              inner wrapper alone is what makes the centered amount glide. */}
          <Stack flex={1} jc="center">
            <Animated.View layout={heroLayout}>
              {/* Separate from the layout-animated wrapper above: the press
                  scale must not fight the hero's glide. */}
              <Animated.View style={amountPressStyle}>
                <SendAutoSizeAmountInput
                  value={amountText}
                  onChange={handleAmountChange}
                  justifyContent="center"
                  inputProps={{
                    placeholder: '0',
                    // The keypad below is the input path. iPads also take a
                    // hardware keyboard, which needs a focusable field; there
                    // a tap on the amount without one attached brings up the
                    // system keyboard too. Review locks it: the amount there
                    // is a way back to editing (overlay below), and disabling
                    // the field ends any editing in progress.
                    editable:
                      Boolean(platformEnv.isNativeIOSPad) && mode === 'input',
                    keyboardType: 'decimal-pad',
                    leftAddOnProps: {
                      label: '$',
                      pr: '$0',
                      pl: '$0',
                      mr: '$-2',
                    },
                  }}
                  valueProps={estimateValueProps}
                  extraContent={
                    // alignSelf breaks out of the root Stack's ai="center":
                    // without a definite slot width the text measures unbounded
                    // and a long message runs off-screen instead of wrapping.
                    // $8 = two $bodySm lines (2 × $4 lineHeight, same s() scale);
                    // numberOfLines truncates copy that outgrows the slot.
                    <Stack h="$8" jc="center" alignSelf="stretch">
                      {/* The line the page opens with is part of the page;
                        only later changes fade. */}
                      <LayoutAnimationConfig skipEntering>
                        {heroNoticeKind ? (
                          <Animated.View
                            key={heroNoticeKind}
                            entering={MOTION_MICRO_ENTERING_AFTER_EXIT}
                            exiting={MOTION_MICRO_EXITING}
                          >
                            {heroNotice}
                          </Animated.View>
                        ) : null}
                      </LayoutAnimationConfig>
                    </Stack>
                  }
                  width="100%"
                />
              </Animated.View>
              {mode === 'review' ? (
                // In review the amount is a way back to editing it — where
                // the eye already is, same move as the header's back arrow.
                // It stops above the notice slot: the order reminder there
                // is its own button.
                <Stack
                  testID="headless-buy-edit-amount"
                  position="absolute"
                  top={0}
                  left={0}
                  right={0}
                  bottom="$8"
                  role="button"
                  aria-label={intl.formatMessage({
                    id: ETranslations.global_edit,
                  })}
                  cursor="pointer"
                  onPressIn={handleAmountPressIn}
                  onPressOut={handleAmountPressOut}
                  onPress={exitReview}
                />
              ) : null}
            </Animated.View>
          </Stack>
          {mode === 'review' ? (
            <Animated.View
              key="review"
              entering={MOTION_BLOCK_ENTERING}
              // Deliberately NO exiting fade: the exit snapshot freezes the
              // subtree, and the native SDK button misbehaves inside it — its
              // overflow-drawn consent copy vanishes at once and the SwiftUI
              // content re-lays-out and sinks within the frozen frame (reads
              // as "Buy loses its terms, then drops"). Cutting straight to
              // unmount removes the artifact window; the input block still
              // fades in over the cleared space (fade-through).
            >
              <YStack gap="$10">
                <CheckoutInfoCard
                  tokenSymbol={activeToken?.symbol ?? ''}
                  networkId={activeToken?.networkId ?? networkId}
                  networkName={activeNetwork?.name}
                  isQuoting={isQuoting}
                  fiatAmount={amount}
                  payout={quote?.payout}
                  networkFee={quote?.networkFee}
                  transactionFee={quote?.transactionFee}
                  providerName={selectedProvider ?? quote?.ramp}
                  address={effectiveAddress}
                  accountName={accountName}
                  onSelectProvider={
                    canSwitchProvider ? handleSelectProvider : undefined
                  }
                />
                <BuyActionZone
                  state={actionState}
                  nativeButton={nativeButton}
                  isMock={isMock}
                  errorText={errorMessage}
                  onMockPay={payMock}
                  onRetry={retry}
                  onViewOrder={
                    unknownOutcomeTransactionId
                      ? openUnknownOutcomeOrder
                      : undefined
                  }
                  onRetryInit={canRetryInit ? retryInit : undefined}
                  onWebFallback={openWebFallback}
                  offerWebFallback={errorCode === 'paymentFailed'}
                  onSwitchAccount={canSignOut ? handleSwitchAccount : undefined}
                />
              </YStack>
            </Animated.View>
          ) : (
            <Animated.View
              key="input"
              entering={MOTION_BLOCK_ENTERING}
              exiting={MOTION_BLOCK_EXITING}
            >
              <YStack gap="$3">
                {/* One slot, two states: presets while the amount is empty
                    (tapping one jumps straight to review); a typed amount
                    morphs the slot into the preview CTA. Clearing the amount
                    brings the presets back. Both render at the large-button
                    height, so the swap never reflows the keypad below, and
                    each fades in place. Not when the whole input block
                    arrives: it fades in as one. */}
                <LayoutAnimationConfig skipEntering>
                  {amount > 0 ? (
                    <Animated.View
                      key="review-cta"
                      entering={MOTION_MICRO_ENTERING}
                      exiting={MOTION_MICRO_EXITING}
                    >
                      <Button
                        testID="headless-buy-review"
                        size="large"
                        variant="primary"
                        disabled={hasAmountError}
                        onPress={enterReview}
                      >
                        {intl.formatMessage({
                          id: ETranslations.global_review_order,
                        })}
                      </Button>
                    </Animated.View>
                  ) : (
                    <Animated.View
                      key="presets"
                      entering={MOTION_MICRO_ENTERING}
                      exiting={MOTION_MICRO_EXITING}
                    >
                      <PresetRow onSelect={handlePresetSelect} />
                    </Animated.View>
                  )}
                </LayoutAnimationConfig>
                <NativeAmountKeypad
                  onKeyPress={handleKeyPress}
                  onBackspaceLongPress={handleBackspaceLongPress}
                />
              </YStack>
            </Animated.View>
          )}
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default HeadlessBuyPage;
