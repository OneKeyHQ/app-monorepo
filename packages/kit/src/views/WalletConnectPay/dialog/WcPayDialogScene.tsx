// cspell:ignore showable
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Image,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  describeWcPaySigningHeadline,
  describeWcPaySigningSummary,
} from './wcPaySigningSummary';

import type { IWcPayDialogTerminalReason } from './wcPayDialogView';
import type {
  IWcPayConfirmingPhase,
  IWcPayInlineSigningSummary,
} from '../hooks/wcPayInlineUtils';

// Presentational layer of the WalletConnect Pay dialog. The skeleton —
// Header (64pt visual over centered text, 48pt/16pt vertical padding),
// optional Body, optional Footer (32pt gap, full-width primary pill) — is a
// 1:1 mirror of the accepted reference in
// packages/components/src/scenarios/WalletConnectPay/WalletConnectPay.stories.tsx
// (Figma Modules / "Walletconnect pay", node 21831-35638; terminal layout
// node 21926-35825). The shell (DialogV2) provides the 24pt side inset and
// the safe-area bottom; nothing here adds horizontal padding of its own.
// Copy comes from the wc_pay_* i18n keys; en_US matches the story verbatim.
// One deliberate divergence from the story: WcPayConfirmingStep adds a
// summary block under its headline while a headless signature is in flight —
// the story predates inline signing and has no step that signs without a
// confirm page to describe what is being signed.

// ---------------------------------------------------------------------------
// Header

function WcPayHeader({
  visual,
  spacing,
  children,
}: {
  /** The 64pt slot: merchant icon, status badge or spinner. */
  visual: ReactNode;
  /** 'roomy' on the transient status steps (48pt), 'regular' otherwise (16pt). */
  spacing: 'regular' | 'roomy';
  children: ReactNode;
}) {
  return (
    <YStack
      alignItems="center"
      gap="$4"
      py={spacing === 'roomy' ? '$12' : '$4'}
    >
      {visual}
      <YStack alignItems="center" gap="$1">
        {children}
      </YStack>
    </YStack>
  );
}

function WcPayHeaderLine({ children }: { children: ReactNode }) {
  return (
    <SizableText size="$bodyLgMedium" color="$textSubdued" textAlign="center">
      {children}
    </SizableText>
  );
}

function WcPayHeaderAmount({ children }: { children: ReactNode }) {
  return (
    <SizableText size="$heading2xl" color="$text" textAlign="center">
      {children}
    </SizableText>
  );
}

function WcPayHeaderDetail({ children }: { children: ReactNode }) {
  return (
    <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
      {children}
    </SizableText>
  );
}

const SPINNER_VISUAL = (
  <Stack w="$16" h="$16" alignItems="center" justifyContent="center">
    {/* The 36pt system spinner scaled to the design's 48pt glyph. */}
    <Spinner size="large" scale={4 / 3} />
  </Stack>
);

const FAILED_BADGE_VISUAL = (
  <Stack
    w="$16"
    h="$16"
    borderRadius="$full"
    borderCurve="continuous"
    bg="$bgCritical"
    alignItems="center"
    justifyContent="center"
  >
    <Icon name="CrossedLargeOutline" size="$8" color="$iconCritical" />
  </Stack>
);

const SUCCESS_BADGE_VISUAL = (
  <Stack
    w="$16"
    h="$16"
    borderRadius="$full"
    borderCurve="continuous"
    bg="$bgSuccessStrong"
    alignItems="center"
    justifyContent="center"
  >
    <Icon name="Checkmark2Solid" size="$8" color="$iconOnColor" />
  </Stack>
);

const FALLBACK_MERCHANT_ICON = require('./walletconnect-dapp-icon.png');

function WcPayMerchantVisual({ iconUri }: { iconUri: string | undefined }) {
  return (
    <Image
      source={iconUri ? { uri: iconUri } : FALLBACK_MERCHANT_ICON}
      w="$16"
      h="$16"
      borderRadius={14}
      borderCurve="continuous"
    />
  );
}

// ---------------------------------------------------------------------------
// Body — payment step only.

export interface IWcPaySceneOption {
  id: string;
  /** Token amount with symbol, e.g. "20 USDC" (Q7). */
  primaryText: string;
  /** Network name, e.g. "Base". */
  secondaryText: string;
  tokenImageUri: string | undefined;
  networkImageUri: string | undefined;
}

export interface IWcPaySceneBanner {
  guidance: string;
  mismatchHint: string | undefined;
}

const SELECTED_CHECK = (
  <Icon name="CheckRadioSolid" size="$6" color="$iconActive" />
);

// Rides the scroll content (not the card) so the inset scrolls away with
// the rows instead of leaving a static gap at the clipped edges.
const ASSET_LIST_CONTENT_CONTAINER_STYLE = { p: '$1' } as const;

function WcPayAssetOptionRow({
  option,
  selected,
  disabled,
  onSelectOption,
}: {
  option: IWcPaySceneOption;
  selected: boolean;
  disabled: boolean;
  onSelectOption: (id: string) => void;
}) {
  const handlePress = useCallback(() => {
    if (disabled) {
      return;
    }
    onSelectOption(option.id);
  }, [disabled, onSelectOption, option.id]);
  return (
    <XStack
      alignItems="center"
      gap="$3"
      minHeight="$12"
      px="$3"
      py="$2"
      borderRadius="$3"
      borderCurve="continuous"
      bg={selected ? '$neutral3' : undefined}
      opacity={disabled && !selected ? 0.5 : 1}
      onPress={handlePress}
    >
      <Stack
        w="$10"
        h="$10"
        borderRadius="$full"
        borderCurve="continuous"
        bg="$bgStrong"
      >
        {option.tokenImageUri ? (
          <Image
            source={{ uri: option.tokenImageUri }}
            w="$10"
            h="$10"
            borderRadius="$full"
            borderCurve="continuous"
          />
        ) : null}
        {option.networkImageUri ? (
          <Stack
            position="absolute"
            right={-4}
            bottom={-4}
            p="$0.5"
            bg="$bgApp"
            borderRadius="$full"
            borderCurve="continuous"
          >
            <Image
              source={{ uri: option.networkImageUri }}
              w="$4"
              h="$4"
              borderRadius="$full"
              borderCurve="continuous"
            />
          </Stack>
        ) : null}
      </Stack>
      <YStack flex={1}>
        <SizableText size={selected ? '$headingMd' : '$bodyLg'} color="$text">
          {option.primaryText}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {option.secondaryText}
        </SizableText>
      </YStack>
      {selected ? SELECTED_CHECK : null}
    </XStack>
  );
}

function WcPayAssetList({
  options,
  selectedId,
  disabled,
  onSelectOption,
}: {
  options: IWcPaySceneOption[];
  selectedId: string | undefined;
  disabled: boolean;
  onSelectOption: (id: string) => void;
}) {
  const intl = useIntl();
  return (
    <YStack>
      <XStack px="$4" py="$2">
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.wc_pay_pay_with__label })}
        </SizableText>
      </XStack>
      {/* Fixed 200pt viewport per the design; overflow scrolls inside. */}
      <YStack
        bg="$neutral3"
        borderRadius="$4"
        borderCurve="continuous"
        height={200}
        overflow="hidden"
      >
        <ScrollView contentContainerStyle={ASSET_LIST_CONTENT_CONTAINER_STYLE}>
          {options.map((option) => (
            <WcPayAssetOptionRow
              key={option.id}
              option={option}
              selected={option.id === selectedId}
              disabled={disabled}
              onSelectOption={onSelectOption}
            />
          ))}
        </ScrollView>
      </YStack>
    </YStack>
  );
}

function WcPayNoticeCard({ children }: { children: ReactNode }) {
  return (
    // Design token is overlays/white-alpha/1 (0.05), one notch dimmer than
    // the populated card's neutral/3 — $neutral2 is the closest app token.
    <YStack bg="$neutral2" borderRadius="$4" borderCurve="continuous" p="$1">
      <YStack px="$4" py="$2" alignItems="center" gap="$1">
        {children}
      </YStack>
    </YStack>
  );
}

function WcPayBannerCard({ banner }: { banner: IWcPaySceneBanner }) {
  return (
    <YStack
      p="$3"
      borderRadius="$3"
      borderCurve="continuous"
      bg="$bgCriticalSubdued"
    >
      <SizableText size="$bodyMd" color="$textCritical">
        {banner.guidance}
      </SizableText>
      {banner.mismatchHint ? (
        <SizableText size="$bodyMd" color="$textCritical">
          {banner.mismatchHint}
        </SizableText>
      ) : null}
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Footer

function WcPayFooter({
  label,
  onPress,
  disabled,
  loading,
  testID,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  testID: string;
  variant?: 'primary' | 'destructive' | 'secondary';
}) {
  return (
    <YStack pt="$8">
      <Button
        testID={testID}
        variant={variant}
        size="large"
        disabled={disabled}
        loading={loading}
        onPress={onPress}
      >
        {label}
      </Button>
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Steps

export function WcPayFetchingStep() {
  const intl = useIntl();
  return (
    <WcPayHeader visual={SPINNER_VISUAL} spacing="roomy">
      <WcPayHeaderLine>
        {intl.formatMessage({
          id: ETranslations.wc_pay_fetching_payment_info__title,
        })}
      </WcPayHeaderLine>
    </WcPayHeader>
  );
}

export function WcPayFetchFailedStep({ onRetry }: { onRetry: () => void }) {
  const intl = useIntl();
  return (
    <>
      <WcPayHeader visual={FAILED_BADGE_VISUAL} spacing="roomy">
        <WcPayHeaderLine>
          {intl.formatMessage({
            id: ETranslations.wc_pay_fetch_payment_info_failed__title,
          })}
        </WcPayHeaderLine>
      </WcPayHeader>
      <WcPayFooter
        testID="wc-pay-dialog-fetch-retry"
        label={intl.formatMessage({ id: ETranslations.global_retry })}
        onPress={onRetry}
      />
    </>
  );
}

export function WcPayUnsupportedStep({ onClose }: { onClose: () => void }) {
  const intl = useIntl();
  return (
    <>
      <WcPayHeader visual={FAILED_BADGE_VISUAL} spacing="roomy">
        <WcPayHeaderLine>
          {intl.formatMessage({
            id: ETranslations.wc_pay_account_type_unsupported__msg,
          })}
        </WcPayHeaderLine>
      </WcPayHeader>
      <WcPayFooter
        testID="wc-pay-dialog-unsupported-close"
        label={intl.formatMessage({ id: ETranslations.global_close })}
        onPress={onClose}
      />
    </>
  );
}

export function WcPayOptionsStep({
  merchantIconUri,
  amountText,
  merchantText,
  options,
  selectedId,
  onSelectOption,
  listDisabled,
  banner,
  empty,
  payButtonText,
  payDisabled,
  payLoading,
  onPay,
  onClose,
}: {
  merchantIconUri: string | undefined;
  amountText: string;
  merchantText: string;
  options: IWcPaySceneOption[];
  selectedId: string | undefined;
  onSelectOption: (id: string) => void;
  listDisabled: boolean;
  banner: IWcPaySceneBanner | undefined;
  empty: 'noAssets' | 'platformRefused' | undefined;
  payButtonText: string;
  payDisabled: boolean;
  payLoading: boolean;
  onPay: () => void;
  onClose: () => void;
}) {
  const intl = useIntl();
  const hasOptions = !empty && options.length > 0;
  return (
    <>
      <WcPayHeader
        visual={<WcPayMerchantVisual iconUri={merchantIconUri} />}
        spacing="regular"
      >
        <WcPayHeaderLine>
          {intl.formatMessage({ id: ETranslations.global_pay })}
        </WcPayHeaderLine>
        <WcPayHeaderAmount>{amountText}</WcPayHeaderAmount>
        {merchantText ? (
          <WcPayHeaderLine>{merchantText}</WcPayHeaderLine>
        ) : null}
      </WcPayHeader>
      {banner ? (
        <YStack pb="$3">
          <WcPayBannerCard banner={banner} />
        </YStack>
      ) : null}
      {hasOptions ? (
        <WcPayAssetList
          options={options}
          selectedId={selectedId}
          disabled={listDisabled}
          onSelectOption={onSelectOption}
        />
      ) : null}
      {empty === 'noAssets' ? (
        <WcPayNoticeCard>
          <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.wc_pay_no_available_asset__title,
            })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.wc_pay_no_available_asset__desc,
            })}
          </SizableText>
        </WcPayNoticeCard>
      ) : null}
      {empty === 'platformRefused' ? (
        <WcPayNoticeCard>
          <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.wc_pay_onchain_unsupported_platform__msg,
            })}
          </SizableText>
        </WcPayNoticeCard>
      ) : null}
      {hasOptions ? (
        <WcPayFooter
          testID="wc-pay-dialog-pay"
          label={payButtonText}
          onPress={onPay}
          disabled={payDisabled}
          loading={payLoading}
        />
      ) : (
        <WcPayFooter
          testID="wc-pay-dialog-empty-close"
          label={intl.formatMessage({ id: ETranslations.global_close })}
          onPress={onClose}
        />
      )}
    </>
  );
}

// Product decision Q5 (2026-08-27): one confirming label for every step, no
// per-step copy. The phase stays a prop so the signing summary can key off it.
export function WcPayConfirmingStep({
  phase,
  amountText,
  signingSummary,
}: {
  /** The attempt's current step; absent while no attempt is running. */
  phase?: IWcPayConfirmingPhase;
  amountText: string;
  /** What the headless signature in flight commits to. */
  signingSummary?: IWcPayInlineSigningSummary;
}) {
  const intl = useIntl();
  // The signature kinds report during `signingMessage`; the approve leg runs
  // the send pipeline instead, so its summary stays up through those phases
  // — `recording` included, because the post-broadcast mined-wait (minutes
  // on a slow chain) runs under that phase and the allowance disclosure must
  // not vanish for it. The executor clears a stale summary at every action
  // boundary.
  const isSummaryVisible =
    Boolean(signingSummary) &&
    (phase === 'signingMessage' ||
      (signingSummary?.kind === 'approve' &&
        (phase === 'estimating' ||
          phase === 'checking' ||
          phase === 'signing' ||
          phase === 'recording')));
  // A personal_sign body is the message itself: multi-line, left-aligned,
  // and SCROLLABLE within a bounded height — every signed byte must be
  // reachable on screen, or the tail of a long message would be signed
  // without ever being showable (display is that leg's whole contract).
  const isMessageBody = signingSummary?.kind === 'personalSign';
  const summaryBody = signingSummary
    ? describeWcPaySigningSummary(signingSummary, intl)
    : '';
  return (
    <WcPayHeader visual={SPINNER_VISUAL} spacing="roomy">
      <WcPayHeaderLine>
        {intl.formatMessage({
          id: ETranslations.wc_pay_confirming_payment__title,
        })}
      </WcPayHeaderLine>
      {isSummaryVisible && signingSummary ? (
        <YStack pt="$3" gap="$1" alignItems="center" alignSelf="stretch">
          <SizableText size="$bodyMd" color="$text" textAlign="center">
            {describeWcPaySigningHeadline(signingSummary, amountText, intl)}
          </SizableText>
          {isMessageBody ? (
            <ScrollView
              maxHeight="$36"
              alignSelf="stretch"
              px="$4"
              showsVerticalScrollIndicator
            >
              <SizableText size="$bodySm" color="$textSubdued" textAlign="left">
                {summaryBody}
              </SizableText>
            </ScrollView>
          ) : (
            <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
              {summaryBody}
            </SizableText>
          )}
        </YStack>
      ) : null}
    </WcPayHeader>
  );
}

export function WcPaySubmittedStep({
  canClose,
  onDone,
}: {
  canClose: boolean;
  onDone: () => void;
}) {
  const intl = useIntl();
  return (
    <>
      <WcPayHeader visual={SPINNER_VISUAL} spacing="roomy">
        <WcPayHeaderLine>
          {intl.formatMessage({
            id: ETranslations.wc_pay_confirming_payment__title,
          })}
        </WcPayHeaderLine>
      </WcPayHeader>
      {canClose ? (
        <WcPayFooter
          testID="wc-pay-dialog-submitted-done"
          label={intl.formatMessage({ id: ETranslations.global_done })}
          onPress={onDone}
        />
      ) : null}
    </>
  );
}

export function WcPaySuccessStep({
  amountText,
  merchantText,
  onDone,
}: {
  amountText: string;
  merchantText: string;
  onDone: () => void;
}) {
  const intl = useIntl();
  return (
    <>
      <WcPayHeader visual={SUCCESS_BADGE_VISUAL} spacing="regular">
        <WcPayHeaderLine>
          {intl.formatMessage({ id: ETranslations.wc_pay_paid__title })}
        </WcPayHeaderLine>
        <WcPayHeaderAmount>{amountText}</WcPayHeaderAmount>
        {merchantText ? (
          <WcPayHeaderLine>{merchantText}</WcPayHeaderLine>
        ) : null}
      </WcPayHeader>
      <WcPayFooter
        testID="wc-pay-dialog-success-done"
        label={intl.formatMessage({ id: ETranslations.global_done })}
        onPress={onDone}
      />
    </>
  );
}

const TERMINAL_COPY: Record<
  IWcPayDialogTerminalReason,
  { title: ETranslations; detail: ETranslations; action: 'retry' | 'close' }
> = {
  failed: {
    title: ETranslations.wc_pay_payment_failed__title,
    detail: ETranslations.wc_pay_payment_failed__desc,
    action: 'retry',
  },
  expired: {
    title: ETranslations.wc_pay_payment_expired__title,
    detail: ETranslations.wc_pay_payment_no_longer_payable__desc,
    action: 'close',
  },
  cancelled: {
    title: ETranslations.wc_pay_payment_cancelled__title,
    detail: ETranslations.wc_pay_payment_no_longer_payable__desc,
    action: 'close',
  },
  alreadyPaid: {
    title: ETranslations.wc_pay_payment_already_completed__title,
    detail: ETranslations.wc_pay_payment_already_paid__desc,
    action: 'close',
  },
};

export function WcPayTerminalStep({
  reason,
  detailText,
  onRetry,
  onClose,
}: {
  reason: IWcPayDialogTerminalReason;
  /** Overrides the default detail line (e.g. a server-reported error text). */
  detailText?: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  const intl = useIntl();
  const copy = TERMINAL_COPY[reason];
  const isRetry = copy.action === 'retry';
  return (
    <>
      <WcPayHeader visual={FAILED_BADGE_VISUAL} spacing="roomy">
        <WcPayHeaderLine>
          {intl.formatMessage({ id: copy.title })}
        </WcPayHeaderLine>
        <WcPayHeaderDetail>
          {detailText ?? intl.formatMessage({ id: copy.detail })}
        </WcPayHeaderDetail>
      </WcPayHeader>
      <WcPayFooter
        testID="wc-pay-dialog-terminal-action"
        label={intl.formatMessage({
          id: isRetry ? ETranslations.global_retry : ETranslations.global_close,
        })}
        onPress={isRetry ? onRetry : onClose}
      />
    </>
  );
}

export function WcPayDamagedStep({
  onDiscard,
  onClose,
  discardLoading,
  discardFailed,
}: {
  onDiscard: () => void;
  onClose: () => void;
  discardLoading: boolean;
  discardFailed: boolean;
}) {
  const intl = useIntl();
  return (
    <>
      <WcPayHeader visual={FAILED_BADGE_VISUAL} spacing="roomy">
        <WcPayHeaderLine>
          {intl.formatMessage({
            id: ETranslations.wc_pay_progress_damaged__title,
          })}
        </WcPayHeaderLine>
        <WcPayHeaderDetail>
          {intl.formatMessage({
            id: discardFailed
              ? ETranslations.wc_pay_discard_failed__desc
              : ETranslations.wc_pay_progress_damaged__desc,
          })}
        </WcPayHeaderDetail>
      </WcPayHeader>
      <YStack pt="$8" gap="$2.5">
        <Button
          testID="wc-pay-dialog-damaged-discard"
          variant="destructive"
          size="large"
          loading={discardLoading}
          onPress={onDiscard}
        >
          {intl.formatMessage({
            id: ETranslations.wc_pay_discard_and_start_over__action,
          })}
        </Button>
        <Button
          testID="wc-pay-dialog-damaged-close"
          size="large"
          disabled={discardLoading}
          onPress={onClose}
        >
          {intl.formatMessage({ id: ETranslations.global_close })}
        </Button>
      </YStack>
    </>
  );
}
