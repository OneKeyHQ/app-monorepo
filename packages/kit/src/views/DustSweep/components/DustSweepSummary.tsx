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
  Dialog,
  Divider,
  Icon,
  IconButton,
  Image,
  SizableText,
  Skeleton,
  Stack,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useDustSweep } from '../DustSweepProvider';
import { getDustSweepTotals } from '../stateMachine';

import { DustSweepSlippage } from './DustSweepSlippage';

import type { IDustSweepState } from '../stateMachine';

function formatAmount(amount: string, decimals: number) {
  return new BigNumber(amount).decimalPlaces(decimals).toFormat();
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
  const totals = getDustSweepTotals(state.items);
  const token = state.snapshot?.nativeToken;
  const amount = totals.receiptUnavailable
    ? '—'
    : `+${formatAmount(totals.receivedAmount, 6)}`;
  const value =
    totals.receiptUnavailable || !token?.price
      ? '—'
      : `$${formatAmount(
          new BigNumber(totals.receivedAmount)
            .times(token?.price ?? 0)
            .toFixed(),
          2,
        )}`;
  const entering = reducedMotion
    ? FadeIn.duration(300)
    : FadeInDown.duration(300)
        .easing(Easing.out(Easing.cubic))
        .withInitialValues({ transform: [{ translateY: 24 }] });
  return (
    <Animated.View entering={entering} style={{ width: '100%' }}>
      <YStack
        testID="dust-sweep-result"
        height={desktop ? 280 : 420}
        px={desktop ? 0 : '$5'}
        pt={desktop ? 76 : 32}
        alignItems="center"
      >
        <Icon name="CheckRadioSolid" color="$iconSuccess" size="$12" />
        <SizableText size="$headingLg" mt="$4" height={24}>
          {intl.formatMessage({ id: ETranslations.title_dust_swept })}
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
        {desktop ? null : (
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
                </SizableText>
                <SizableText size="$bodyMdMedium">
                  {totals.skippedCount}
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
                {intl.formatMessage({ id: ETranslations.sweep_sweep_again })}
              </Button>
            </YStack>
          </>
        )}
      </YStack>
    </Animated.View>
  );
}

export function DustSweepSummary({
  desktop,
  onDone,
}: {
  desktop: boolean;
  onDone: () => void;
}) {
  const model = useDustSweep();
  const {
    session,
    selecting,
    current,
    preview,
    selected,
    valueUsd,
    loadStatus,
  } = model;
  const { state } = session;
  const intl = useIntl();
  const totals = getDustSweepTotals(state.items);
  const nativeToken = state.snapshot?.nativeToken ?? current?.nativeToken;
  const completed = state.phase === 'completed';
  const unknown = state.items.some((item) => item.status === 'unknown');
  const amount = selecting ? preview.amount : totals.receivedAmount;
  const quoteLoading =
    selecting && selected.length > 0 && preview.status === 'loading';
  const quoteError = selecting && preview.status === 'error';
  const amountUnavailable =
    quoteError || (!selecting && totals.receiptUnavailable);
  const progress =
    completed || state.phase === 'paused'
      ? totals.settledCount
      : Math.min(totals.settledCount + 1, state.items.length);
  let label = intl.formatMessage(
    { id: ETranslations.button_convert_tokens_estimated_amount },
    { count: selected.length, amount: `$${formatAmount(valueUsd, 2)}` },
  );
  let onPress: () => void | Promise<void> = model.start;
  if (completed) {
    label = intl.formatMessage({
      id: desktop ? ETranslations.sweep_sweep_again : ETranslations.global_done,
    });
    onPress = desktop ? model.sweepAgain : onDone;
  } else if (state.phase === 'paused') {
    label = intl.formatMessage({ id: ETranslations.global_continue });
    onPress = session.resume;
  } else if (!selecting) {
    label = intl.formatMessage({ id: ETranslations.button_stop_conversion });
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
      height={desktop ? 540 : 209}
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
                  <XStack height={24} gap="$1" alignItems="center">
                    <IconButton
                      testID="dust-sweep-refresh-quotes"
                      icon="RotateClockwiseOutline"
                      variant="tertiary"
                      width={24}
                      height={24}
                      minHeight={24}
                      p={0}
                      mx={0}
                      my={0}
                      opacity={quoteError ? 1 : 0}
                      disabled={!quoteError}
                      pointerEvents={quoteError ? 'auto' : 'none'}
                      onPress={model.retryPreview}
                      accessibilityLabel={intl.formatMessage({
                        id: ETranslations.swap_page_button_refresh_quotes,
                      })}
                    />
                    <SizableText size="$bodyLgMedium" height={24}>
                      {amountUnavailable ? '—' : formatAmount(amount, 6)}{' '}
                      {nativeToken?.symbol}
                    </SizableText>
                  </XStack>
                  <SizableText size="$bodyMd" color="$textSubdued" height={20}>
                    {amountUnavailable || !nativeToken?.price
                      ? '—'
                      : `$${formatAmount(
                          new BigNumber(amount)
                            .times(nativeToken?.price ?? 0)
                            .toFixed(),
                          2,
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
            <XStack
              height={20}
              justifyContent="space-between"
              alignItems="center"
            >
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.swap_page_provider_provider,
                })}
              </SizableText>
              <XStack gap="$1" alignItems="center">
                <Image
                  source={{ uri: preview.providerLogo }}
                  width={20}
                  height={20}
                  borderRadius="$1"
                  fallback={<Icon name="OkxBrand" size="$5" />}
                />
                <SizableText size="$bodyMdMedium">OKX</SizableText>
              </XStack>
            </XStack>
            <XStack
              height={20}
              justifyContent="space-between"
              alignItems="center"
            >
              <XStack gap="$1" alignItems="center">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.slippage_tolerance_title,
                  })}
                </SizableText>
                <Tooltip
                  renderTrigger={
                    <IconButton
                      testID="dust-sweep-slippage-help"
                      icon="QuestionmarkOutline"
                      iconProps={{ color: '$iconSubdued', size: '$5' }}
                      variant="tertiary"
                      width={20}
                      height={20}
                      minHeight={20}
                      p={0}
                      mx={0}
                      my={0}
                      accessibilityLabel={intl.formatMessage({
                        id: ETranslations.slippage_tolerance_title,
                      })}
                      onPress={
                        platformEnv.isNative
                          ? () => {
                              Dialog.show({
                                title: intl.formatMessage({
                                  id: ETranslations.slippage_tolerance_title,
                                }),
                                description: intl.formatMessage({
                                  id: ETranslations.slippage_tolerance_popover,
                                }),
                                showFooter: false,
                              });
                            }
                          : undefined
                      }
                    />
                  }
                  renderContent={intl.formatMessage({
                    id: ETranslations.slippage_tolerance_popover,
                  })}
                />
              </XStack>
              <DustSweepSlippage />
            </XStack>
          </>
        ) : (
          <XStack
            height={20}
            alignItems="center"
            justifyContent="space-between"
            gap="$2"
            mt={desktop ? 7 : 14}
          >
            <SizableText
              size="$bodyMd"
              color={unknown ? '$textCritical' : '$textSubdued'}
            >
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
            </XStack>
          </XStack>
        )}
      </YStack>
      {desktop ? <Stack flex={1} /> : <Stack height={8} />}
      <Button
        testID="dust-sweep-action"
        height={46}
        minHeight={46}
        variant="primary"
        borderRadius="$3"
        disabled={
          unknown ||
          session.leaving ||
          state.phase === 'pausing' ||
          (selecting &&
            (loadStatus !== 'ready' || !selected.length || quoteLoading))
        }
        onPress={onPress}
      >
        {label}
      </Button>
    </YStack>
  );
}
