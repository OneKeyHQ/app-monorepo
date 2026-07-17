import type { ReactNode } from 'react';

import {
  Button,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { EBuyActionState } from './types';

// The native block's RN-side layout height is EXACTLY 56 (device-measured
// 2026-07-17, coinbasepay): the SwiftUI consent copy under the button draws
// in OVERFLOW below the view's bounds and occupies no RN layout space at all.
// So the reserve only needs to even out our 46pt placeholder/retry buttons
// against the 56pt native button; content is TOP-anchored so the button's
// top edge never moves across states (the zone's bottom edge is pinned to
// the page bottom, so growth would extend upward — never bottom-align here).
const ZONE_MIN_HEIGHT = 56;

// Mock-preview only: the real SDK button renders its own consent sentence
// (with document links) under the native Buy button; the mock mimics that
// structure so the reserved slot reads the same in the Gallery.
const MOCK_TOS_TEXT = '點擊即表示同意 Onramper 的服務條款與隱私政策';

type IProps = {
  state: EBuyActionState;
  nativeButton: ReactNode;
  isMock: boolean;
  errorText?: string;
  onMockPay: () => void;
  onRetry: () => void;
  onWebFallback: () => void;
};

// The pay action zone on the review screen: renders exactly one of S1–S5.
// Branches swap INSTANTLY, with no transition — deliberate and settled: every
// animated variant (cross-fade, sequenced fades, measured-height glide, an
// opaque cover over the native button, page-persisted height ratchets) was
// tried on device and read worse than a hard swap, because the native block's
// height is unknowable up front (button + consent copy chosen per quote by
// the routed provider). Do not reintroduce transitions here.
export function BuyActionZone({
  state,
  nativeButton,
  isMock,
  errorText,
  onMockPay,
  onRetry,
  onWebFallback,
}: IProps) {
  let content: ReactNode;

  if (state === EBuyActionState.WebFallback) {
    // S5 — structural failure: hand over to the web widget.
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
          onPress={onWebFallback}
        >
          改用網頁版購買
        </Button>
      </YStack>
    );
  } else if (state === EBuyActionState.RetryableError) {
    // S4 — retryable error (message rendered in the amount hero slot above).
    content = (
      <Button
        testID="headless-buy-retry"
        size="large"
        variant="primary"
        onPress={onRetry}
      >
        重試
      </Button>
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
        {state === EBuyActionState.Preparing ? '詢價中…' : '購買'}
      </Button>
    );
  } else {
    // S2 / S3 — ready or refreshing (e.g. provider switch). In mock mode we
    // render our own button (the mock returns button: null); on device this
    // is the SDK native button.
    content = (
      <Stack
        // TEMPORARY(onramper-debug): measure the real native block (button +
        // provider consent copy) so ZONE_MIN_HEIGHT can be set to the actual
        // value instead of an estimate. Remove before merge.
        onLayout={
          platformEnv.isDev
            ? ({ nativeEvent }) =>
                console.log(
                  '[onramper-debug] zone content height',
                  Math.ceil(nativeEvent.layout.height),
                  'state',
                  state,
                )
            : undefined
        }
      >
        {isMock ? (
          <YStack gap="$2">
            <Button
              testID="headless-buy-pay"
              size="large"
              variant="primary"
              onPress={onMockPay}
            >
              用 Apple Pay 購買
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
    // Top-anchored on purpose — see ZONE_MIN_HEIGHT.
    <Stack minHeight={ZONE_MIN_HEIGHT}>{content}</Stack>
  );
}
