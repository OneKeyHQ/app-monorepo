import { useMemo } from 'react';
import type { ReactNode } from 'react';

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
  NumberSizeableText,
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
import { SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE } from '@onekeyhq/kit/src/views/Swap/utils/swapDesktopCardShadow';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useDustSweep } from '../DustSweepProvider';
import { useDustSweepFiatFormatter } from '../hooks/useDustSweepFiatFormatter';
import { getDustSweepPresentation } from '../stateMachine';

import { DustSweepResultBreakdown } from './DustSweepResultBreakdown';
import { DustSweepSlippage } from './DustSweepSlippage';

import type { IDustSweepState } from '../stateMachine';

// Height of the summary action button; the desktop hidden-tokens row aligns to it.
export const DUST_SWEEP_ACTION_HEIGHT = 46;

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
  const formatFiat = useDustSweepFiatFormatter();
  const { totals, outcome } = getDustSweepPresentation(state);
  const hasSuccess = totals.successCount > 0;
  const resultTitleId = {
    pending: ETranslations.global_pending,
    failed: ETranslations.dust_sweep_failed,
    partial: ETranslations.title_dust_sweep_completed,
    success: ETranslations.title_dust_swept,
  }[outcome];
  const token = state.snapshot?.nativeToken;
  const amountFormatterOptions = useMemo(
    () => ({ showPlusMinusSigns: true, tokenSymbol: token?.symbol }),
    [token?.symbol],
  );
  const amountUnavailable = totals.receiptUnavailable || !hasSuccess;
  const value =
    totals.receiptUnavailable || !hasSuccess || !token?.price
      ? '—'
      : formatFiat(new BigNumber(totals.receivedAmount).times(token.price));
  const entering = reducedMotion
    ? FadeIn.duration(300)
    : FadeInDown.duration(300)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ transform: [{ translateY: 24 }] });
  const allFailed = outcome === 'failed';
  return (
    <Stack width="100%" flexShrink={0}>
      <Animated.View entering={entering} style={{ width: '100%' }}>
        <YStack
          testID="dust-sweep-result"
          px={desktop ? 0 : '$5'}
          pt={desktop ? 24 : 16}
          pb={desktop ? 0 : '$5'}
          alignItems="center"
        >
          {/* Same success / failed / pending graphics as the Swap result. */}
          <SwapTransactionResultStatus
            status={outcome === 'partial' ? 'success' : outcome}
          />
          <SizableText size="$headingLg" mt="$4" height={24}>
            {intl.formatMessage({ id: resultTitleId })}
          </SizableText>
          {allFailed ? (
            <SizableText
              testID="dust-sweep-result-subtitle"
              size="$bodyMd"
              color="$textSubdued"
              textAlign="center"
              mt="$1.5"
            >
              {intl.formatMessage(
                { id: ETranslations.dust_no_tokens_converted },
                { count: state.items.length },
              )}
            </SizableText>
          ) : (
            <>
              <SizableText
                testID="dust-sweep-result-amount"
                size="$heading5xl"
                fontSize={40}
                lineHeight={48}
                height={48}
                mt={desktop ? 6 : 8}
                numberOfLines={1}
              >
                {amountUnavailable ? (
                  `— ${token?.symbol ?? ''}`
                ) : (
                  <NumberSizeableText
                    key={intl.locale}
                    size="$heading5xl"
                    fontSize={40}
                    lineHeight={48}
                    formatter="balance"
                    formatterOptions={amountFormatterOptions}
                  >
                    {totals.receivedAmount}
                  </NumberSizeableText>
                )}
              </SizableText>
              <SizableText
                size="$bodyLgMedium"
                color="$textSubdued"
                height={24}
                mt={desktop ? 4 : 6}
              >
                {value}
              </SizableText>
            </>
          )}
          <Divider width="100%" mt="$6" mb="$4" />
          <DustSweepResultBreakdown state={state} collapsible={!desktop} />
          {desktop ? null : (
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
                {intl.formatMessage({ id: ETranslations.global_done })}
              </Button>
            </YStack>
          )}
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
    selected,
    selectedValueUsd,
    canStart,
    loadStatus,
    assetStatus,
    providerInfo,
  } = model;
  const { state } = session;
  const assetSyncError = selecting && assetStatus === 'error';
  const assetsLoading =
    selecting && (loadStatus === 'loading' || assetStatus === 'refreshing');
  const intl = useIntl();
  const formatFiat = useDustSweepFiatFormatter();
  const { totals, completed, unknown, progress } =
    getDustSweepPresentation(state);
  const nativeToken = state.snapshot?.nativeToken ?? current?.nativeToken;
  const receiveFormatterOptions = useMemo(
    () => ({ tokenSymbol: nativeToken?.symbol }),
    [nativeToken?.symbol],
  );
  const receiveTokenLoading = assetsLoading && !nativeToken;
  // Before converting, estimate from the selection's market value (as Rabby
  // does) so it always matches the action label; afterwards show what arrived.
  const nativePrice = new BigNumber(nativeToken?.price ?? NaN);
  const hasNativePrice = nativePrice.isFinite() && nativePrice.gt(0);
  let amount = totals.receivedAmount;
  if (selecting)
    amount = hasNativePrice
      ? new BigNumber(selectedValueUsd).div(nativePrice).toFixed()
      : '0';
  const amountUnavailable = selecting
    ? !hasNativePrice
    : totals.receiptUnavailable || unknown;
  // No receive token means no network to sweep on (e.g. a wallet with no
  // assets), so show zero instead of placeholders.
  let receiveAmount: ReactNode = '0.00';
  let receiveValue = formatFiat('0');
  if (nativeToken) {
    receiveAmount = amountUnavailable ? (
      `— ${nativeToken.symbol}`
    ) : (
      <NumberSizeableText
        key={intl.locale}
        size="$bodyLgMedium"
        formatter="balance"
        formatterOptions={receiveFormatterOptions}
      >
        {amount}
      </NumberSizeableText>
    );
    if (selecting) receiveValue = formatFiat(selectedValueUsd);
    else
      receiveValue =
        amountUnavailable || !hasNativePrice
          ? '—'
          : formatFiat(new BigNumber(amount).times(nativePrice));
  }
  let label = intl.formatMessage(
    { id: ETranslations.button_convert_tokens_estimated_amount },
    {
      count: selected.length,
      amount: formatFiat(selectedValueUsd),
    },
  );
  let onPress: () => void | Promise<void> = () => {
    model.start();
  };
  if (completed) {
    label = intl.formatMessage({ id: ETranslations.global_done });
    onPress = desktop ? model.sweepAgain : onDone;
  } else if (unknown) {
    label = intl.formatMessage({ id: ETranslations.global_details });
    onPress = onDetails;
  } else if (state.phase === 'paused') {
    label = intl.formatMessage({ id: ETranslations.global_continue });
    onPress = session.resume;
  } else if (assetSyncError) {
    label = `${intl.formatMessage({ id: ETranslations.global_sync_error })} · ${intl.formatMessage({ id: ETranslations.global_retry })}`;
    onPress = model.retryAssets;
  } else if (!selecting) {
    label = intl.formatMessage({ id: ETranslations.global_pause });
    onPress = session.pause;
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
      {...(desktop ? { flex: 1 } : { height: 209 })}
      flexShrink={0}
      px="$5"
      pt={desktop ? '$5' : '$0'}
      pb={desktop ? '$5' : 33}
      {...(desktop
        ? {
            borderWidth: 1,
            borderColor: '$borderSubdued',
            borderRadius: '$5',
            // Same halo as the desktop Swap cards.
            '$platform-web': SWAP_DESKTOP_CARD_SHADOW_WEB_STYLE,
          }
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
            {receiveTokenLoading ? (
              <Stack testID="dust-sweep-receive-token-loading">
                <Skeleton width="$8" height="$8" radius="round" />
              </Stack>
            ) : (
              <Token
                size="md"
                tokenImageUri={nativeToken?.logoURI}
                networkId={nativeToken?.networkId}
                showNetworkIcon
              />
            )}
            {nativeToken ? (
              <SizableText size="$bodyLgMedium">
                {nativeToken.symbol}
              </SizableText>
            ) : null}
            <YStack flex={1} alignItems="flex-end" height={44}>
              {loadStatus === 'loading' ? (
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
                  <SizableText
                    testID="dust-sweep-receive-amount"
                    size="$bodyLgMedium"
                    height={24}
                  >
                    {receiveAmount}
                  </SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued" height={20}>
                    {receiveValue}
                  </SizableText>
                </>
              )}
            </YStack>
          </XStack>
        </>
      )}
      {/* Desktop completion shows its counts inside the result above. */}
      {completed && desktop ? null : (
        <>
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
                      // The configured provider; quotes happen per token on submit.
                      providerIcon={
                        loadStatus === 'ready' ? (providerInfo?.logo ?? '') : ''
                      }
                      providerName={
                        loadStatus === 'ready'
                          ? (providerInfo?.providerName ?? '')
                          : ''
                      }
                      allowProviderWithoutTokens
                      isLoading={loadStatus === 'loading'}
                      showEmptyPlaceholder
                      valueProps={{
                        numberOfLines: 1,
                        maxWidth: desktop ? 180 : 164,
                        flexShrink: 1,
                      }}
                    />
                  </Stack>
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
                  <Icon
                    name="ArrowRightOutline"
                    size="$4"
                    color="$iconSubdued"
                  />
                  <Token size="xs" tokenImageUri={nativeToken?.logoURI} />
                  <SizableText size="$bodyMdMedium">
                    {completed ? totals.successCount : progress}/
                    {state.items.length}
                  </SizableText>
                  {completed && totals.notConvertedCount ? (
                    <SizableText size="$bodyMd" color="$textSubdued">
                      ({totals.notConvertedCount}{' '}
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
        </>
      )}
      {desktop ? <Stack flex={1} /> : <Stack height={8} />}
      <XStack gap="$2.5">
        {/* Paused: Stop gives up the remaining tokens, Continue resumes. */}
        {state.phase === 'paused' && !unknown ? (
          <Button
            testID="dust-sweep-stop"
            flex={1}
            height={DUST_SWEEP_ACTION_HEIGHT}
            minHeight={DUST_SWEEP_ACTION_HEIGHT}
            loading={model.stopping}
            disabled={session.leaving || model.stopping}
            onPress={model.stop}
          >
            {intl.formatMessage({ id: ETranslations.button_stop_conversion })}
          </Button>
        ) : null}
        <Button
          testID="dust-sweep-action"
          flex={1}
          height={DUST_SWEEP_ACTION_HEIGHT}
          minHeight={DUST_SWEEP_ACTION_HEIGHT}
          variant="primary"
          loading={assetsLoading}
          childrenAsText={!assetsLoading}
          accessibilityLabel={
            assetsLoading
              ? intl.formatMessage({ id: ETranslations.global_syncing })
              : undefined
          }
          disabled={
            assetsLoading ||
            session.leaving ||
            model.stopping ||
            state.phase === 'left' ||
            (selecting && loadStatus !== 'ready') ||
            (selecting && !canStart && !assetSyncError)
          }
          onPress={onPress}
        >
          {assetsLoading ? null : label}
        </Button>
      </XStack>
    </YStack>
  );
}
