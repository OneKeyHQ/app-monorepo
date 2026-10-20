import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useReducedMotion,
} from 'react-native-reanimated';

import {
  Button,
  Divider,
  Icon,
  IconButton,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { SwapTransactionResultStatus } from '@onekeyhq/kit/src/views/Swap/components/PreSwapConfirmResult';
import SwapCommonInfoItem from '@onekeyhq/kit/src/views/Swap/components/SwapCommonInfoItem';
import SwapProviderInfoItem from '@onekeyhq/kit/src/views/Swap/components/SwapProviderInfoItem';
import { SwapRefreshButtonBase } from '@onekeyhq/kit/src/views/Swap/components/SwapRefreshButton';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useDustSweep } from '../DustSweepProvider';
import { getDustSweepPresentation } from '../stateMachine';

import { DustSweepSlippage } from './DustSweepSlippage';

import type { IDustSweepState } from '../stateMachine';

// Height of the summary action button; the desktop hidden-tokens row aligns to it.
export const DUST_SWEEP_ACTION_HEIGHT = 46;

function formatAmount(amount: string, decimals: number) {
  return new BigNumber(amount).decimalPlaces(decimals).toFormat();
}

function formatFiatAmount(amount: string) {
  return new BigNumber(amount).toFormat(2);
}

export function DustSweepResult({
  state,
  desktop = false,
  onDetails,
  onAgain,
}: {
  state: IDustSweepState;
  desktop?: boolean;
  onDetails?: () => void;
  onAgain?: () => void;
}) {
  const intl = useIntl();
  const reducedMotion = useReducedMotion();
  const { totals, outcome } = getDustSweepPresentation(state);
  const hasIssues = totals.failedCount > 0 || totals.skippedCount > 0;
  const hasHardFailures = totals.failedCount > 0;
  const hasSuccess = totals.successCount > 0;
  let resultTitleId = ETranslations.title_dust_swept;
  if (outcome === 'pending') resultTitleId = ETranslations.global_pending;
  else if (!hasSuccess) resultTitleId = ETranslations.global_failed;
  else if (hasIssues) {
    resultTitleId = ETranslations.title_dust_sweep_completed;
    if (!hasSuccess && hasHardFailures)
      resultTitleId = ETranslations.global_failed;
  }
  const token = state.snapshot?.nativeToken;
  const amount =
    totals.receiptUnavailable || !hasSuccess
      ? '—'
      : `+${formatAmount(totals.receivedAmount, 6)}`;
  const value =
    totals.receiptUnavailable || !hasSuccess || !token?.price
      ? '—'
      : `$${formatFiatAmount(
          new BigNumber(totals.receivedAmount)
            .times(token?.price ?? 0)
            .toFixed(),
        )}`;
  const entering = reducedMotion
    ? FadeIn.duration(300)
    : FadeInDown.duration(300)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ transform: [{ translateY: 24 }] });
  return (
    <Stack width="100%" height={desktop ? 280 : 420} flexShrink={0}>
      <Animated.View entering={entering} style={{ width: '100%' }}>
        <YStack
          testID="dust-sweep-result"
          height={desktop ? 280 : 420}
          px={desktop ? 0 : '$5'}
          pt={desktop ? 76 : 32}
          alignItems="center"
        >
          <SwapTransactionResultStatus
            status={outcome === 'partial' ? 'success' : outcome}
            size={48}
            animated={false}
          />
          <SizableText size="$headingLg" mt="$4" height={24}>
            {intl.formatMessage({ id: resultTitleId })}
          </SizableText>
          <SizableText
            testID="dust-sweep-result-amount"
            size="$heading5xl"
            fontSize={40}
            lineHeight={48}
            height={48}
            mt={desktop ? 6 : 8}
            numberOfLines={1}
          >
            {amount} {token?.symbol}
          </SizableText>
          <SizableText
            size="$bodyLgMedium"
            color="$textSubdued"
            height={24}
            mt={desktop ? 4 : 6}
          >
            {value}
          </SizableText>
          {!desktop ? (
            <>
              <YStack width="100%" mt="$8" gap="$4">
                <XStack height={20} justifyContent="space-between">
                  <SizableText color="$textSubdued" size="$bodyMd">
                    {intl.formatMessage({ id: ETranslations.label_converted })}
                  </SizableText>
                  <SizableText size="$bodyMdMedium">
                    {totals.successCount}
                  </SizableText>
                </XStack>
                <XStack height={20} justifyContent="space-between">
                  <SizableText color="$textSubdued" size="$bodyMd">
                    {intl.formatMessage({ id: ETranslations.label_skipped })}
                    {totals.failedCount > 0 ? ' / ' : null}
                    {totals.failedCount > 0
                      ? intl.formatMessage({ id: ETranslations.global_failed })
                      : null}
                  </SizableText>
                  <SizableText size="$bodyMdMedium">
                    {totals.failedCount > 0
                      ? `${totals.skippedCount} / ${totals.failedCount}`
                      : totals.skippedCount}
                  </SizableText>
                </XStack>
              </YStack>
              <YStack width="100%" mt="$6" gap="$2.5">
                <Button
                  testID="dust-sweep-view-details"
                  height={46}
                  minHeight={46}
                  onPress={onDetails}
                >
                  {intl.formatMessage({ id: ETranslations.global_details })}
                </Button>
                <Button
                  testID="dust-sweep-result-again"
                  height={46}
                  minHeight={46}
                  variant="primary"
                  onPress={onAgain}
                >
                  {intl.formatMessage({
                    id:
                      state.phase === 'completed'
                        ? ETranslations.sweep_sweep_again
                        : ETranslations.global_done,
                  })}
                </Button>
              </YStack>
            </>
          ) : null}
        </YStack>
      </Animated.View>
    </Stack>
  );
}

export function DustSweepSummary({
  desktop,
  onDone,
  onDetails,
}: {
  desktop: boolean;
  onDone: () => void;
  onDetails: () => void;
}) {
  const model = useDustSweep();
  const {
    session,
    selecting,
    current,
    preview,
    selected,
    quotedValueUsd,
    canStart,
    isFocused,
    loadStatus,
    assetStatus,
    providerInfo,
  } = model;
  const { state } = session;
  const intl = useIntl();
  const { totals, completed, unknown, progress } =
    getDustSweepPresentation(state);
  const nativeToken = state.snapshot?.nativeToken ?? current?.nativeToken;
  const amount = selecting ? preview.amount : totals.receivedAmount;
  const quoteLoading =
    selecting && selected.length > 0 && preview.status === 'loading';
  const quoteRefreshing =
    selecting &&
    (preview.status === 'loading' || preview.status === 'refreshing');
  const quoteError = selecting && preview.status === 'error';
  const quoteUnavailable =
    selecting && selected.length > 0 && preview.quotedCount === 0;
  const quoteExpired = selecting && preview.status === 'expired';
  const partialQuote = selecting && preview.status === 'partial';
  const syncingAssets = selecting && assetStatus === 'refreshing';
  const assetSyncError = selecting && assetStatus === 'error';
  const unavailableCount = Object.keys(preview.unavailable).length;
  const amountUnavailable =
    quoteUnavailable || (!selecting && (totals.receiptUnavailable || unknown));
  const emptyProviderInfo =
    selected.length === 0 && loadStatus === 'ready' ? providerInfo : undefined;
  let label = intl.formatMessage(
    { id: ETranslations.button_convert_tokens_estimated_amount },
    {
      count: preview.quotedCount,
      amount: `$${formatFiatAmount(quotedValueUsd)}`,
    },
  );
  let onPress: () => void | Promise<void> = () => {
    model.start();
  };
  if (completed) {
    label = intl.formatMessage({
      id: desktop ? ETranslations.sweep_sweep_again : ETranslations.global_done,
    });
    onPress = desktop ? model.sweepAgain : onDone;
  } else if (unknown) {
    label = intl.formatMessage({ id: ETranslations.global_details });
    onPress = onDetails;
  } else if (state.phase === 'paused') {
    label = intl.formatMessage({ id: ETranslations.global_continue });
    onPress = session.resume;
  } else if (!selecting) {
    label = intl.formatMessage({ id: ETranslations.button_stop_conversion });
    onPress = session.pause;
  }
  if (selecting && quoteRefreshing)
    label = intl.formatMessage({
      id: ETranslations.swap_page_button_fetching_quotes,
    });
  if (quoteExpired) {
    label = intl.formatMessage({
      id: ETranslations.swap_page_button_refresh_quotes,
    });
    onPress = model.retryPreview;
  }
  if (syncingAssets)
    label = intl.formatMessage({ id: ETranslations.global_syncing });
  if (assetSyncError) {
    label = `${intl.formatMessage({ id: ETranslations.global_sync_error })} · ${intl.formatMessage({ id: ETranslations.global_retry })}`;
    onPress = model.retryAssets;
  }
  let progressLabel = ETranslations.label_conversion_progress;
  if (unknown) {
    progressLabel = ETranslations.global_pending;
  } else if (completed) {
    progressLabel = ETranslations.label_converted;
  } else if (state.phase === 'paused') {
    progressLabel = ETranslations.sweep_dust_sweep_paused;
  }
  return (
    <YStack
      testID="dust-sweep-summary"
      // Desktop fills the row so it matches the token list card height.
      {...(desktop ? { flex: 1 } : { height: 209 + (partialQuote ? 28 : 0) })}
      flexShrink={0}
      px="$5"
      pt={desktop ? '$5' : '$0'}
      pb={desktop ? '$5' : 33}
      {...(desktop
        ? { borderWidth: 1, borderColor: '$borderSubdued', borderRadius: '$5' }
        : { borderTopWidth: 1, borderColor: '$borderSubdued' })}
    >
      {completed && desktop ? (
        <DustSweepResult state={state} desktop />
      ) : (
        <>
          {desktop ? (
            <SizableText size="$bodyMd" color="$textSubdued" height={20}>
              {intl.formatMessage({ id: ETranslations.sweep_you_receive })}
            </SizableText>
          ) : null}
          <XStack height={desktop ? 72 : 60} alignItems="center" gap="$2">
            <Token
              size="md"
              tokenImageUri={nativeToken?.logoURI}
              networkId={nativeToken?.networkId}
            />
            <SizableText size="$bodyLgMedium">
              {nativeToken?.symbol ?? '—'}
            </SizableText>
            <YStack flex={1} alignItems="flex-end" height={44}>
              {quoteLoading || loadStatus === 'loading' ? (
                <>
                  <Stack height={24} justifyContent="center">
                    <Skeleton width={96} height={16} />
                  </Stack>
                  <Stack height={20} justifyContent="center">
                    <Skeleton width={60} height={12} />
                  </Stack>
                </>
              ) : (
                <>
                  <SizableText size="$bodyLgMedium" height={24}>
                    {amountUnavailable ? '—' : formatAmount(amount, 6)}{' '}
                    {nativeToken?.symbol}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued" height={20}>
                    {amountUnavailable || !nativeToken?.price
                      ? '—'
                      : `$${formatFiatAmount(
                          new BigNumber(amount)
                            .times(nativeToken?.price ?? 0)
                            .toFixed(),
                        )}`}
                  </SizableText>
                </>
              )}
            </YStack>
          </XStack>
        </>
      )}
      {desktop ? <Divider /> : null}
      <YStack height={desktop ? 65 : 62} pt={desktop ? 16 : 14} gap="$2">
        {selecting ? (
          <>
            <XStack height={20} alignItems="center" gap="$2">
              <Stack flex={1} minWidth={0}>
                <SwapProviderInfoItem
                  testID="dust-sweep-provider"
                  showFeeInfo={false}
                  fromToken={selected[0]}
                  toToken={nativeToken}
                  providerIcon={
                    emptyProviderInfo?.logo ??
                    (!quoteUnavailable && preview.providers.length === 1
                      ? (preview.providers[0].providerLogo ?? '')
                      : '')
                  }
                  providerName={
                    emptyProviderInfo?.providerName ??
                    (quoteUnavailable
                      ? intl.formatMessage({
                          id: ETranslations.swap_page_provider_rate_unavailable,
                        })
                      : preview.providers
                          .map(
                            (provider) =>
                              provider.providerName || provider.provider,
                          )
                          .join(', '))
                  }
                  allowProviderWithoutTokens={!!emptyProviderInfo}
                  isLoading={quoteLoading || loadStatus === 'loading'}
                  showEmptyPlaceholder
                  valueProps={{
                    numberOfLines: 1,
                    maxWidth: desktop ? 180 : 164,
                    flexShrink: 1,
                  }}
                />
              </Stack>
              {selected.length &&
              loadStatus === 'ready' &&
              !syncingAssets &&
              !assetSyncError ? (
                <Stack
                  testID="dust-sweep-refresh-quotes"
                  accessibilityLabel={intl.formatMessage({
                    id: ETranslations.swap_page_button_refresh_quotes,
                  })}
                >
                  <SwapRefreshButtonBase
                    refreshAction={model.retryPreview}
                    disabled={quoteRefreshing || !isFocused}
                    isRefreshQuote={quoteRefreshing}
                    isLoading={quoteRefreshing}
                    isFocused={isFocused}
                    manualRefreshRequired={quoteError || quoteExpired}
                    autoRefreshTimerActive={preview.autoRefreshTimerActive}
                  />
                </Stack>
              ) : null}
            </XStack>
            <SwapCommonInfoItem
              containerProps={{ height: 20 }}
              title={intl.formatMessage({
                id: ETranslations.slippage_tolerance_title,
              })}
              questionMarkPopoverProps={{
                mountNativePortalBeforeOpen: true,
                renderTrigger: (
                  <IconButton
                    testID="dust-sweep-slippage-help"
                    icon="InfoCircleOutline"
                    iconSize="$3.5"
                    iconProps={{ color: '$iconSubdued' }}
                    accessibilityLabel={intl.formatMessage({
                      id: ETranslations.slippage_tolerance_title,
                    })}
                    variant="tertiary"
                    size="small"
                    hotKey
                    width="$3.5"
                    height="$3.5"
                    minHeight="$3.5"
                    borderWidth={0}
                    p={0}
                    m={0}
                  />
                ),
              }}
              questionMarkContent={
                <SizableText p="$4" $gtMd={{ size: '$bodyMd' }}>
                  {intl.formatMessage({
                    id: ETranslations.slippage_tolerance_popover,
                  })}
                </SizableText>
              }
              valueComponent={<DustSweepSlippage />}
            />
          </>
        ) : (
          <XStack
            height={20}
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
            mt={desktop ? 7 : 14}
          >
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: progressLabel })}
            </SizableText>
            <XStack alignItems="center" gap="$1" flexShrink={0}>
              <XStack pr="$1">
                {state.items.slice(0, 3).map((item, index) => (
                  <Stack
                    key={item.token.key}
                    ml={index ? -8 : 0}
                    borderWidth={1}
                    borderColor="$bgApp"
                    borderRadius="$full"
                  >
                    <Token size="xs" tokenImageUri={item.token.logoURI} />
                  </Stack>
                ))}
              </XStack>
              <Icon name="ArrowRightOutline" size="$4" color="$iconSubdued" />
              <Token size="xs" tokenImageUri={nativeToken?.logoURI} />
              <SizableText size="$bodyMdMedium">
                {completed ? totals.successCount : progress}/
                {state.items.length}
              </SizableText>
              {completed && totals.skippedCount ? (
                <SizableText size="$bodyMd" color="$textSubdued">
                  ({totals.skippedCount}{' '}
                  {intl
                    .formatMessage({ id: ETranslations.label_skipped })
                    .toLowerCase()}
                  )
                </SizableText>
              ) : null}
              {completed && !desktop ? (
                <IconButton
                  testID="dust-sweep-reopen-details"
                  icon="InfoCircleOutline"
                  variant="tertiary"
                  size="small"
                  height={20}
                  minHeight={20}
                  width={20}
                  p={0}
                  mx={0}
                  my={0}
                  accessibilityLabel={intl.formatMessage({
                    id: ETranslations.global_details,
                  })}
                  onPress={onDetails}
                />
              ) : null}
            </XStack>
          </XStack>
        )}
      </YStack>
      {partialQuote ? (
        <SizableText
          testID="dust-sweep-partial-quotes"
          size="$bodySm"
          color="$textSubdued"
          mt="$2"
          height={20}
        >
          {unavailableCount}{' '}
          {intl.formatMessage({ id: ETranslations.label_skipped })}
        </SizableText>
      ) : null}
      {desktop ? <Stack flex={1} /> : <Stack height={8} />}
      <Button
        testID="dust-sweep-action"
        height={DUST_SWEEP_ACTION_HEIGHT}
        minHeight={DUST_SWEEP_ACTION_HEIGHT}
        variant="primary"
        disabled={
          session.leaving ||
          state.phase === 'left' ||
          (selecting && loadStatus !== 'ready') ||
          (selecting && !canStart && !quoteExpired && !assetSyncError)
        }
        onPress={onPress}
      >
        {label}
      </Button>
    </YStack>
  );
}
