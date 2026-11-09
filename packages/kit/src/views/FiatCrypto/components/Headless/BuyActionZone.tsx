import type { ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';

import { EBuyActionState } from './types';

import type { LayoutChangeEvent } from 'react-native';

// Since SDK 1.2.2-1 the native pay button reports its full height, consent
// sentence included (~90pt with Coinbase), instead of drawing that sentence
// outside a 56pt box. So the 50pt "getting quote" placeholder the zone shows
// before the button is shorter, and the breakdown above jumped by the
// difference each time a quote landed. The zone reserves the height of the
// tallest pay block it has measured as its minimum height. Content stays
// TOP-anchored so the button's top edge never moves; the zone's bottom is
// pinned to the page bottom.
// Remembered across launches, but only from the latest visit: the height
// depends on the routed provider's consent copy (and the text size), so a
// taller block seen once must not leave a gap under shorter ones for good.
const DEFAULT_ZONE_MIN_HEIGHT = 56;
// Anything taller is a bad measurement (a layout pass mid-transition), not a
// pay block; reserving it would leave a hole.
const MAX_REMEMBERED_ZONE_HEIGHT = 160;

// Stored as a string, not a number: on iOS/Android the main runtime reads
// settings from a snapshot the background runtime builds at cold start, and
// that snapshot reads each value with getString first — which MMKV answers
// with "" (not undefined) for a stored number. A remembered number therefore
// came back empty after every relaunch (seen on device); a string survives.
function readRememberedZoneHeight(): number {
  const remembered = Number(
    appStorage.syncStorage.getString(
      EAppSyncStorageKeys.onekey_onramper_pay_zone_height,
    ),
  );
  return Number.isFinite(remembered) &&
    remembered > DEFAULT_ZONE_MIN_HEIGHT &&
    remembered <= MAX_REMEMBERED_ZONE_HEIGHT
    ? remembered
    : DEFAULT_ZONE_MIN_HEIGHT;
}

async function rememberZoneHeight(height: number) {
  try {
    await appStorage.syncStorage.set(
      EAppSyncStorageKeys.onekey_onramper_pay_zone_height,
      String(height),
    );
  } catch {
    // Not remembered: the next visit measures the pay block again.
  }
}

// Failure-state secondary actions: medium tertiary (text) buttons, 34pt tall.
// The variant's negative margins — there so a text button's label lines up
// with the text around it — are cancelled: these sit full width under the
// primary button, so their pressed fill matches its width and stays in their
// own space. 5pt of slop each way makes 44pt targets; stacked 10pt apart
// ($2.5) neighboring targets meet without overlapping, and the zone's 8pt
// gap keeps the first one's slop off the primary button.
const SECONDARY_ACTION_PROPS = {
  size: 'medium',
  variant: 'tertiary',
  my: 0,
  mx: 0,
  hitSlop: { top: 5, bottom: 5 },
} as const;

// Actions that wait on the network (signing out, opening the web widget):
// the button spins and ignores taps until the handler settles. Button only
// waits on its handler with a non-zero press debounce — at the default 0 the
// press goes through a trailing debounce that returns before the handler
// runs, so the spinner would clear at once.
const ASYNC_ACTION_PROPS = {
  onPressLoadingEnabled: true,
  onPressDebounce: 300,
} as const;

// Mock-preview only: the real SDK button renders its own consent sentence
// (with document links) under the native Buy button; the mock mimics that
// structure so the reserved slot reads the same in the Gallery.
const MOCK_TOS_TEXT =
  'By continuing you agree to the Onramper Terms of Service and Privacy Policy';

type IProps = {
  state: EBuyActionState;
  nativeButton: ReactNode;
  isMock: boolean;
  errorText?: string;
  onMockPay: () => void;
  onRetry: () => void;
  // Set when the failure on screen left the payment outcome unknown: the
  // retry gives way to opening that order, so a second payment is never one
  // tap away while the first may have gone through.
  onViewOrder?: () => void;
  // Set when the fallback on screen came from a failed init that another
  // attempt may fix: offered under the web widget, which stays the main way
  // out.
  onRetryInit?: () => void;
  // Settles once the widget opened or failed to: its button spins until then.
  onWebFallback: () => Promise<void> | void;
  // Set when the failure on screen is a declined payment: the provider may
  // turn the same card down again (region, limits), while the web widget can
  // route to another one — so it is offered under the retry.
  offerWebFallback?: boolean;
  // Set when an OnramperID login may be what keeps failing (e.g. its KYC
  // country doesn't match the current region): dropping it lets the next
  // checkout verify a different email and phone. Offered only on failures —
  // it is a way out of a stuck account, not an everyday action — and never
  // while the payment outcome is unknown: signing out prepares a fresh
  // checkout in place. Settles when the sign-out does: the button spins and
  // ignores taps until then.
  onSwitchAccount?: () => Promise<void>;
};

// The pay action zone on the review screen: renders exactly one of S1–S5.
// Branches swap INSTANTLY, with no transition — deliberate and settled: every
// animated variant (cross-fade, sequenced fades, measured-height glide, an
// opaque cover over the native button) was tried on device and read worse
// than a hard swap. Do not reintroduce transitions here.
export function BuyActionZone({
  state,
  nativeButton,
  isMock,
  errorText,
  onMockPay,
  onRetry,
  onViewOrder,
  onRetryInit,
  onWebFallback,
  offerWebFallback,
  onSwitchAccount,
}: IProps) {
  const intl = useIntl();
  const [minHeight, setMinHeight] = useState(readRememberedZoneHeight);
  const minHeightRef = useRef(minHeight);
  // Tallest pay block measured during this visit: what the next one reserves.
  const visitMaxHeightRef = useRef(0);
  // Measures the pay block (native or mock) whenever it is on screen. Grows
  // the reservation at once; never shrinks it on screen (that would move the
  // card under the user) — a shorter block is reserved from the next visit.
  // Passes under the 56pt minimum are the button mid-swap, not a pay block.
  const handlePayBlockLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.ceil(event.nativeEvent.layout.height);
    if (
      height < DEFAULT_ZONE_MIN_HEIGHT ||
      height > MAX_REMEMBERED_ZONE_HEIGHT ||
      height <= visitMaxHeightRef.current
    ) {
      return;
    }
    visitMaxHeightRef.current = height;
    void rememberZoneHeight(height);
    if (height > minHeightRef.current) {
      minHeightRef.current = height;
      setMinHeight(height);
    }
  }, []);

  let content: ReactNode;
  const webFallbackLabel = intl.formatMessage({
    id: ETranslations.buy_on_web__action,
  });
  // Not under "View order": signing out prepares a fresh checkout in place,
  // which must not happen while the first payment may have gone through.
  const switchAccountButton =
    onSwitchAccount && !onViewOrder ? (
      <Button
        testID="headless-buy-switch-account"
        {...SECONDARY_ACTION_PROPS}
        {...ASYNC_ACTION_PROPS}
        onPress={onSwitchAccount}
      >
        {intl.formatMessage({
          id: ETranslations.buy_use_another_email__action,
        })}
      </Button>
    ) : null;

  if (state === EBuyActionState.WebFallback) {
    // S5 — structural failure, or an init that kept failing: hand over to the
    // web widget, with an in-place retry when another init may pass. The
    // reason reads as an explanation, not an alarm: the way forward is right
    // below it.
    content = (
      <YStack gap="$2">
        {errorText ? (
          <SizableText size="$bodySm" color="$textSubdued" ta="center">
            {errorText}
          </SizableText>
        ) : null}
        <Button
          testID="headless-buy-web-fallback"
          size="large"
          variant="primary"
          {...ASYNC_ACTION_PROPS}
          onPress={onWebFallback}
        >
          {webFallbackLabel}
        </Button>
        {onRetryInit || switchAccountButton ? (
          <YStack gap="$2.5">
            {onRetryInit ? (
              <Button
                testID="headless-buy-retry-init"
                {...SECONDARY_ACTION_PROPS}
                onPress={onRetryInit}
              >
                {intl.formatMessage({ id: ETranslations.global_try_again })}
              </Button>
            ) : null}
            {switchAccountButton}
          </YStack>
        ) : null}
      </YStack>
    );
  } else if (state === EBuyActionState.RetryableError) {
    const showWebFallback = offerWebFallback && !onViewOrder;
    // S4 — retryable error. The reason sits right above the action that
    // answers it (amount-level errors stay under the amount instead: the page
    // sends the user back there to fix them). With the payment outcome unknown
    // the action is checking the order; buying again stays possible by going
    // back to the amount screen.
    content = (
      <YStack gap="$2">
        {errorText ? (
          <XStack
            testID="headless-buy-zone-error"
            jc="center"
            ai="flex-start"
            gap="$1.5"
            pb="$1"
          >
            <Icon
              name="ErrorOutline"
              size="$4"
              color="$iconCritical"
              mt="$0.5"
            />
            <SizableText
              size="$bodyMd"
              color="$textCritical"
              flexShrink={1}
              numberOfLines={3}
            >
              {errorText}
            </SizableText>
          </XStack>
        ) : null}
        {onViewOrder ? (
          <Button
            testID="headless-buy-view-order"
            size="large"
            variant="primary"
            onPress={onViewOrder}
          >
            {intl.formatMessage({ id: ETranslations.buy_view_order__action })}
          </Button>
        ) : (
          <Button
            testID="headless-buy-retry"
            size="large"
            variant="primary"
            onPress={onRetry}
          >
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        )}
        {showWebFallback || switchAccountButton ? (
          <YStack gap="$2.5">
            {showWebFallback ? (
              <Button
                testID="headless-buy-retry-web-fallback"
                {...SECONDARY_ACTION_PROPS}
                {...ASYNC_ACTION_PROPS}
                onPress={onWebFallback}
              >
                {webFallbackLabel}
              </Button>
            ) : null}
            {switchAccountButton}
          </YStack>
        ) : null}
      </YStack>
    );
  } else if (
    state === EBuyActionState.Preparing ||
    state === EBuyActionState.InvalidAmount
  ) {
    // S1 — quoting (spinner) / invalid amount (plain disabled).
    content = (
      <Button
        testID="headless-buy-placeholder"
        size="large"
        variant="primary"
        disabled
        loading={state === EBuyActionState.Preparing}
      >
        {intl.formatMessage({
          id:
            state === EBuyActionState.Preparing
              ? ETranslations.buy_quote_loading__msg
              : ETranslations.global_buy,
        })}
      </Button>
    );
  } else {
    // S2 / S3 — ready or refreshing (e.g. provider switch). In mock mode we
    // render our own button (the mock returns button: null); on device this
    // is the SDK native button.
    content = (
      <Stack onLayout={handlePayBlockLayout}>
        {isMock ? (
          <YStack gap="$2">
            <Button
              testID="headless-buy-pay"
              size="large"
              variant="primary"
              onPress={onMockPay}
            >
              Buy with Apple Pay
            </Button>
            <SizableText size="$bodySm" color="$textSubdued" ta="center">
              {MOCK_TOS_TEXT}
            </SizableText>
          </YStack>
        ) : (
          nativeButton
        )}
        {state === EBuyActionState.Refreshing ? (
          <Stack
            position="absolute"
            left={0}
            right={0}
            top={0}
            bottom={0}
            ai="center"
            jc="center"
            bg="$bgApp"
            opacity={0.55}
            borderRadius="$3"
          >
            <Spinner size="small" />
          </Stack>
        ) : null}
      </Stack>
    );
  }

  return (
    // Top-anchored on purpose — see DEFAULT_ZONE_MIN_HEIGHT.
    <Stack minHeight={minHeight}>{content}</Stack>
  );
}
