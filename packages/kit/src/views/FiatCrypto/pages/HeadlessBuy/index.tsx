import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CommonActions, useNavigation, useRoute } from '@react-navigation/core';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import {
  ActionList,
  Button,
  HeaderIconButton,
  Page,
  SizableText,
  Stack,
  Toast,
  YStack,
  usePreventRemove,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NativeAmountKeypad } from '@onekeyhq/kit/src/components/NativeAmountKeypad';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { SendAutoSizeAmountInput } from '@onekeyhq/kit/src/views/Send/components/SendAutoSizeAmountInput';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IOnramperEvent,
  IOnramperQuote,
} from '@onekeyhq/shared/src/modules3rdParty/onramper';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalFiatCryptoRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalFiatCryptoParamList } from '@onekeyhq/shared/src/routes';
import { openFiatCryptoUrl } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { BuyActionZone } from '../../components/Headless/BuyActionZone';
import { CheckoutInfoCard } from '../../components/Headless/CheckoutInfoCard';
import {
  MOTION_EASE_IN,
  MOTION_EASE_IN_OUT,
  MOTION_EASE_OUT,
  MOTION_ENTER_MS,
  MOTION_EXIT_MS,
  MOTION_MICRO_MS,
} from '../../components/Headless/motionTokens';
import { PresetRow } from '../../components/Headless/PresetRow';
import { EBuyActionState } from '../../components/Headless/types';
import { useOnramperCheckout } from '../../components/Headless/useOnramperCheckout';
import { toOnramperNetworkCode } from '../../utils/onramperCodes';

import type { RouteProp } from '@react-navigation/core';

// Pure black pill in both themes (deliberate design choice, not theme-driven);
// borderRadius = half of the native button's 56pt min-height → fully rounded.
const HEADLESS_BUY_BUTTON_STYLE = {
  backgroundColor: '#000000',
  foregroundColor: '#FFFFFF',
  borderRadius: 28,
} as const;

// Dev-preview destination for the Gallery entry, which carries no accountId
// (production entries always resolve the real account address). Franco's own
// wallet — real-money staging checkouts land here, so NEVER swap in a
// placeholder address (EIP-55 checksum verified 2026-07-16).
const DEV_PREVIEW_ETH_ADDRESS = '0x6289201F7AabF9b9aAEf2B3C25018aA26e0102f0';

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

// Mode-swap animation: the leaving lower block fades out fast (accelerating,
// overlaid at its last position), the entering one fades in slower
// (decelerating) into the cleared space, and the amount block's layout
// transition glides it to its new centered position over the enter duration —
// reanimated coordinates all three, which moti's AnimatePresence did not (the
// hero snapped). Durations/easings come from the shared motion tokens.

function HeadlessBuyPage() {
  const route =
    useRoute<
      RouteProp<IModalFiatCryptoParamList, EModalFiatCryptoRoutes.HeadlessBuy>
    >();
  const { networkId, accountId, tokenAddress, type, token } = route.params;
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();

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

  const handleKeyPress = useCallback(
    (key: string) => {
      if (key === 'backspace') {
        handleAmountChange(amountText.slice(0, -1));
        return;
      }
      if (key === '.') {
        if (amountText.includes('.')) {
          return;
        }
        handleAmountChange(amountText ? `${amountText}.` : '0.');
        return;
      }
      const next = amountText === '0' ? key : `${amountText}${key}`;
      handleAmountChange(next);
    },
    [amountText, handleAmountChange],
  );

  const handleBackspaceLongPress = useCallback(() => {
    handleAmountChange('');
  }, [handleAmountChange]);

  const amount = Number(amountText) || 0;

  const enterReview = useCallback(() => {
    setMode('review');
  }, []);

  // Preset tap = one-step buy entry: fill the amount AND jump straight to
  // review (the quote debounce runs there; the zone shows 詢價中 meanwhile).
  const handlePresetSelect = useCallback(
    (value: string) => {
      handleAmountChange(value);
      setMode('review');
    },
    [handleAmountChange],
  );

  // Set right before an intentional close (completed checkout) so the
  // review-mode leave interception below lets that removal through.
  const allowLeaveRef = useRef(false);

  // Resolve the route token from the network's buy list when the entry passed
  // only an address.
  const { result: buyTokens } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceFiatCrypto.getTokensList({
        networkId,
        type: 'buy',
        accountId,
      }),
    [networkId, accountId],
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
      });
    }
  }, [activeToken, networkId]);

  const { result: address } = usePromiseResult(async () => {
    if (!accountId) {
      return undefined;
    }
    return backgroundApiProxy.serviceAccount.getAccountAddressForApi({
      networkId,
      accountId,
    });
  }, [accountId, networkId]);

  // Network display name for the review card's network row.
  const { result: activeNetwork } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: activeToken?.networkId ?? networkId,
      }),
    [activeToken?.networkId, networkId],
  );

  // USD market price of the token, from OneKey's own feed — the review card
  // prices the payout with it. Deliberately NOT derived from the Onramper
  // quote: the SDK's `rate` is exactly payout/amount echoed back (verified on
  // device 2026-07-17), so it can never reveal spread or a bad quote.
  const { result: marketPrice } = usePromiseResult(async () => {
    try {
      const detail =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenDetailByTokenAddress(
          activeToken?.address ?? tokenAddress,
          activeToken?.networkId ?? networkId,
          { skipConvertCurrency: true, autoHandleError: false },
        );
      const price = Number(detail?.data?.token?.price);
      return Number.isFinite(price) && price > 0 ? price : undefined;
    } catch {
      // No market price (long-tail token / endpoint hiccup): the card hides
      // the parenthetical instead of substituting a different-meaning number.
      return undefined;
    }
  }, [activeToken?.address, activeToken?.networkId, tokenAddress, networkId]);

  // The address actually used for quoting; also shown on the review card so
  // the user can confirm the destination before paying.
  const effectiveAddress =
    address ??
    (platformEnv.isDev && !accountId ? DEV_PREVIEW_ETH_ADDRESS : undefined);

  const buttonStyle = useMemo(() => HEADLESS_BUY_BUTTON_STYLE, []);

  // Reference-stable: this is a dependency of the hook's debounce effect.
  const onlyOnramps = useMemo(
    () => (selectedProvider ? [selectedProvider] : undefined),
    [selectedProvider],
  );

  // Latest quote for the completion handler — handleCompleted is a param of
  // the checkout hook, so it is defined before the hook returns `quote`;
  // the ref is assigned right after the hook call below.
  const quoteRef = useRef<IOnramperQuote | undefined>(undefined);

  const handleCompleted = useCallback(
    (event: IOnramperEvent) => {
      // Bypass the review leave guard first: the reset below removes this
      // screen and fires beforeRemove. Then WIPE the buy flow from the modal
      // stack instead of pushing — the native pay button is consumed, so
      // back must not be able to reach it; the success page becomes the only
      // route in the stack.
      allowLeaveRef.current = true;
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: EModalFiatCryptoRoutes.HeadlessBuySuccess,
              params: {
                fiatAmount: amount,
                tokenSymbol: activeToken?.symbol ?? '',
                networkId: activeToken?.networkId ?? networkId,
                networkName: activeNetwork?.name,
                payout: quoteRef.current?.payout,
                providerName: selectedProvider ?? quoteRef.current?.ramp,
                address: effectiveAddress,
                checkoutId: event.checkoutId,
              },
            },
          ],
        }),
      );
    },
    [
      navigation,
      amount,
      activeToken?.symbol,
      activeToken?.networkId,
      networkId,
      activeNetwork?.name,
      selectedProvider,
      effectiveAddress,
    ],
  );

  const openWebFallback = useCallback(async () => {
    const { url } =
      await backgroundApiProxy.serviceFiatCrypto.generateWidgetUrl({
        networkId,
        tokenAddress: activeToken?.address ?? tokenAddress,
        accountId,
        type,
      });
    if (url) {
      openFiatCryptoUrl(url);
    }
  }, [networkId, activeToken?.address, tokenAddress, accountId, type]);

  const {
    actionState,
    nativeButton,
    quote,
    isMock,
    errorMessage,
    errorCode,
    payMock,
    retry,
    signOut,
  } = useOnramperCheckout({
    amount,
    // Quote from the first digit — the ≈crypto estimate is live while typing.
    isAmountValid: amountText !== '' && amount > 0 && Boolean(activeToken),
    source: 'usd',
    destination: activeToken?.symbol?.toLowerCase() ?? '',
    // Onramper speaks its own network slugs (e.g. 'ethereum'), not OneKey ids.
    network:
      toOnramperNetworkCode(activeToken?.networkId ?? networkId) ??
      activeToken?.networkId ??
      networkId,
    address: effectiveAddress,
    // TEMPORARY(onramper-staging): wave-1 headless providers cover US/EU only,
    // and providers enforce country == device IP == verified-phone country, so
    // dev pins the one combination our staging test setup satisfies (US). The
    // EU/Paybis path is untested. Production must omit country (geo-detect).
    country: platformEnv.isDev ? 'us' : undefined,
    onlyOnramps,
    buttonStyle,
    onCompleted: handleCompleted,
  });
  quoteRef.current = quote;

  // Leaving review abandons the mounted native pay button: the SDK's prepared
  // intents are single-mount, so remounting the same element on a later entry
  // renders blank. Re-quote on exit so the next entry gets a fresh button.
  const exitReview = useCallback(() => {
    setMode('input');
    retry();
  }, [retry]);

  // In review, every page-leave intent (header X / back arrow, Android back,
  // iOS swipe) returns to the input view instead of closing the modal.
  // A screen-level headerLeft override can't do this reliably: on iOS 26 the
  // modal close is a navigator-level `unstable_headerLeftItems` bar item that
  // takes the slot over `headerLeft`. usePreventRemove (NOT a raw beforeRemove
  // preventDefault): it registers the prevented state with the native stack so
  // gesture-driven dismissals are blocked up front — cancelling a native
  // gesture after the fact leaves native and JS navigation state out of sync
  // and has frozen the app on close (intermittent hard-hang, device-observed).
  usePreventRemove(mode === 'review', ({ data }) => {
    if (allowLeaveRef.current) {
      // Completed checkout: let the blocked action (the success-page reset)
      // through.
      reactNavigation.dispatch(data.action);
      return;
    }
    exitReview();
  });

  // Amount-level failures are fixed on the input screen, not retried in place.
  // The quote error stays visible under the amount (heroError below) until the
  // next edit re-quotes.
  useEffect(() => {
    if (
      mode === 'review' &&
      actionState === EBuyActionState.RetryableError &&
      errorCode &&
      AMOUNT_ERROR_CODES.has(errorCode)
    ) {
      setMode('input');
    }
  }, [mode, actionState, errorCode]);

  const heroError =
    actionState === EBuyActionState.RetryableError ? errorMessage : undefined;

  const heroLayout = layoutAnimReady
    ? LinearTransition.duration(MOTION_ENTER_MS).easing(MOTION_EASE_IN_OUT)
    : undefined;

  // TEMPORARY(onramper-debug): trace the review→input bottom-button jolt —
  // timestamps of state flips + block geometry. Remove before merge.
  useEffect(() => {
    if (platformEnv.isDev) {
      console.log('[onramper-debug] mode ->', mode);
    }
  }, [mode]);
  useEffect(() => {
    if (platformEnv.isDev) {
      console.log('[onramper-debug] actionState ->', actionState);
    }
  }, [actionState]);

  // Always-mounted fade for the error line — the slot is fixed-height, so
  // only opacity moves; the last message is retained so the text doesn't
  // blank out mid-fade.
  const lastHeroErrorRef = useRef<string | undefined>(undefined);
  if (heroError) {
    lastHeroErrorRef.current = heroError;
  }
  const heroErrorStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(heroError ? 1 : 0, {
        duration: MOTION_MICRO_MS,
        easing: MOTION_EASE_OUT,
      }),
    }),
    [heroError],
  );

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
    ActionList.show({
      title: '選擇供應商',
      sections: [
        {
          items: [
            {
              label: '自動（推薦）',
              onPress: () => setSelectedProvider(undefined),
            },
            ...providerOptions.map((slug) => ({
              label: slug.charAt(0).toUpperCase() + slug.slice(1),
              onPress: () => setSelectedProvider(slug),
            })),
          ],
        },
      ],
    });
  }, [providerOptions]);

  // Dev-only: drop the stored OnramperID login so the next checkout re-runs
  // email + phone verification (needed to switch the verified phone country
  // on staging).
  const renderDevSignOutButton = useCallback(
    () =>
      platformEnv.isDev ? (
        <HeaderIconButton
          testID="headless-buy-dev-signout"
          icon="LogoutOutline"
          onPress={async () => {
            await signOut();
            Toast.success({
              title: '已登出 OnramperID',
              message: '下次購買將重新驗證郵箱和手機號',
            });
          }}
        />
      ) : null,
    [signOut],
  );

  return (
    <Page>
      {/* In review the close button returns to input via the beforeRemove
          interception above. */}
      <Page.Header
        title={activeToken?.symbol ? `購買 ${activeToken.symbol}` : '購買'}
        headerRight={renderDevSignOutButton}
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
              <SendAutoSizeAmountInput
                value={amountText}
                onChange={handleAmountChange}
                justifyContent="center"
                inputProps={{
                  placeholder: '0',
                  // The custom keypad below is the only input path.
                  editable: false,
                  keyboardType: 'decimal-pad',
                  leftAddOnProps: { label: '$', pr: '$0', pl: '$0', mr: '$-2' },
                }}
                valueProps={estimateValueProps}
                extraContent={
                  <Stack h="$6" jc="center" ai="center">
                    <Animated.View style={heroErrorStyle}>
                      <SizableText size="$bodySm" color="$textCritical">
                        {heroError ?? lastHeroErrorRef.current ?? ''}
                      </SizableText>
                    </Animated.View>
                  </Stack>
                }
                width="100%"
              />
            </Animated.View>
          </Stack>
          {mode === 'review' ? (
            <Animated.View
              key="review"
              entering={FadeIn.duration(MOTION_ENTER_MS).easing(
                MOTION_EASE_OUT,
              )}
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
                  marketPrice={marketPrice}
                  payout={quote?.payout}
                  networkFee={quote?.networkFee}
                  transactionFee={quote?.transactionFee}
                  providerName={selectedProvider ?? quote?.ramp}
                  address={effectiveAddress}
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
                  onWebFallback={openWebFallback}
                />
              </YStack>
            </Animated.View>
          ) : (
            <Animated.View
              key="input"
              entering={FadeIn.duration(MOTION_ENTER_MS).easing(
                MOTION_EASE_OUT,
              )}
              exiting={FadeOut.duration(MOTION_EXIT_MS).easing(MOTION_EASE_IN)}
              // TEMPORARY(onramper-debug): remove before merge.
              onLayout={
                platformEnv.isDev
                  ? ({ nativeEvent }) =>
                      console.log(
                        '[onramper-debug] input block y',
                        Math.round(nativeEvent.layout.y),
                        'h',
                        Math.round(nativeEvent.layout.height),
                      )
                  : undefined
              }
            >
              <YStack gap="$3">
                {/* One slot, two states: presets while the amount is empty
                    (tapping one jumps straight to review); a typed amount
                    morphs the slot into the preview CTA. Clearing the amount
                    brings the presets back. Both render at the large-button
                    height, so the swap never reflows the keypad below. */}
                {amount > 0 ? (
                  <Button
                    testID="headless-buy-review"
                    size="large"
                    variant="primary"
                    onPress={enterReview}
                  >
                    預覽訂單
                  </Button>
                ) : (
                  <PresetRow onSelect={handlePresetSelect} />
                )}
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
