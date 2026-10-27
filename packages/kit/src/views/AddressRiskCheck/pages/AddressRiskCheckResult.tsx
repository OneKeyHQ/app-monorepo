import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  Divider,
  Icon,
  IconButton,
  Illustration,
  LottieView,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useNetInfo,
} from '@onekeyhq/components';
import { useClipboard } from '@onekeyhq/components/src/hooks/useClipboard';
import type { IFooterActionsProps } from '@onekeyhq/components/src/layouts/Page/PageFooterActions';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { formatKytRiskFactorName } from '@onekeyhq/kit/src/utils/kytRiskFactorUtils';
import { KYT_LEVEL_TEXT_COLOR } from '@onekeyhq/kit/src/utils/kytRiskLevelColorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalAddressRiskCheckRoutes,
  IModalAddressRiskCheckParamList,
} from '@onekeyhq/shared/src/routes/addressRiskCheck';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IAddressRiskCheckResult } from '@onekeyhq/shared/types/addressRiskCheck';

import { AddressRiskMoreAnalysis } from '../components/AddressRiskMoreAnalysis';
import { CardRow } from '../components/RiskCheckShared';
import { RiskExposureList } from '../components/RiskExposureList';
import { RiskScoreMeter } from '../components/RiskScoreMeter';
import { useAddressRiskCheckRequest } from '../hooks/useCheckAddressRisk';
import {
  formatRiskPercent,
  getAddressRiskCheckPendingMessageIds,
  getAddressRiskSummaryVariant,
  getRiskExposureStats,
  isRiskTaggedAddress,
} from '../utils/addressRiskCheckResultUtils';

import type { IAddressRiskSummaryVariant } from '../utils/addressRiskCheckResultUtils';
import type { RouteProp } from '@react-navigation/core';

const SUMMARY_CONTENT: Record<
  IAddressRiskSummaryVariant,
  // High and Severe show the exchange warning in place of a description.
  { title: ETranslations; description?: ETranslations }
> = {
  clean: {
    title: ETranslations.kyt_no_significant_risk_detected__title,
    description: ETranslations.address_risk_check_summary_clean__desc,
  },
  low: {
    title: ETranslations.kyt_low_risk_detected__title,
    description: ETranslations.address_risk_check_summary_low__desc,
  },
  moderate: {
    title: ETranslations.kyt_moderate_risk_detected__title,
    description: ETranslations.address_risk_check_summary_moderate__desc,
  },
  high: {
    title: ETranslations.kyt_high_risk_detected__title,
  },
  severe: {
    title: ETranslations.kyt_severe_risk_detected__title,
  },
  // Checking / failed results never reach the content page; keep a safe
  // fallback for any unexpected level.
  unknown: {
    title: ETranslations.address_risk_check_level_failed__title,
    description: ETranslations.address_risk_check_level_failed__desc,
  },
};

// Page close flag that tells the Send flow to continue to the amount step.
const CONTINUE_SEND_FLAG = 'continueSend';

const continueToSend: IFooterActionsProps['onConfirm'] = (
  _close,
  closePageStack,
) => {
  closePageStack({ flag: CONTINUE_SEND_FLAG });
};

const backToEdit: IFooterActionsProps['onConfirm'] = (
  _close,
  closePageStack,
) => {
  closePageStack();
};

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  misttrack: 'MistTrack',
};

function StatItem({
  label,
  value,
  valueNumberOfLines = 1,
}: {
  label: string;
  value: string;
  valueNumberOfLines?: number;
}) {
  return (
    <YStack flex={1} gap="$0.5" minWidth={0}>
      <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" numberOfLines={valueNumberOfLines}>
        {value}
      </SizableText>
    </YStack>
  );
}

function AddressRiskCheckResultContent({
  result,
  showMoreAnalysis,
  onContinue,
  isHistoryResult,
}: {
  result: IAddressRiskCheckResult;
  showMoreAnalysis: boolean;
  onContinue?: () => void | Promise<void>;
  isHistoryResult?: boolean;
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const isSendFlow = Boolean(onContinue) && !showMoreAnalysis;

  const { result: network } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: result.networkId,
      }),
    [result.networkId],
  );

  const checkedAtText = formatDate(new Date(result.checkedAt * 1000));
  const variant = getAddressRiskSummaryVariant({
    level: result.level,
    factorCount: result.reasons.length,
  });
  const summaryContent = SUMMARY_CONTENT[variant];
  const titleText = intl.formatMessage({ id: summaryContent.title });
  const isTaggedAddress = isRiskTaggedAddress(result.reasons);
  let descriptionText: ReactNode;
  if (isTaggedAddress) {
    // Name the tag instead of describing exposures the page no longer lists.
    const tags = Array.from(
      new Set(
        result.reasons.map((factor) =>
          formatKytRiskFactorName({ factor, intl }),
        ),
      ),
    );
    // The tag is the key fact, so it reads stronger than the sentence.
    descriptionText = intl.formatMessage(
      { id: ETranslations.address_risk_check_tagged_address__desc },
      {
        tags: (
          <SizableText key="tags" size="$bodyMdMedium" color="$text">
            {tags.join(', ')}
          </SizableText>
        ),
      },
    );
  } else if (summaryContent.description) {
    descriptionText = intl.formatMessage({ id: summaryContent.description });
  }
  const isHighOrSevere = variant === 'high' || variant === 'severe';
  const severeAdvice = intl.formatMessage({
    id: ETranslations.address_risk_check_severe_advice__desc,
  });
  // The advice runs into the next sentence; CJK full-width punctuation
  // already separates them, Latin text needs a space.
  const severeAdviceText = /[\u3002\uff01\uff1f]$/.test(severeAdvice)
    ? severeAdvice
    : `${severeAdvice} `;
  const canContinueToSend =
    isSendFlow &&
    (variant === 'clean' || variant === 'low' || variant === 'moderate');
  const stats = getRiskExposureStats(result.reasons);
  const showExposures = stats.total > 0 && !isTaggedAddress;
  // Name the top exposure with its share so the stat reads on its own.
  let topExposureText = '-';
  if (stats.top) {
    const topName = formatKytRiskFactorName({ factor: stats.top, intl });
    topExposureText =
      stats.top.percent === undefined
        ? topName
        : `${topName} ${formatRiskPercent(stats.top.percent)}`;
  }
  const score =
    variant !== 'unknown' &&
    result.score !== undefined &&
    Number.isFinite(result.score)
      ? result.score
      : undefined;
  const providerName: string | undefined =
    PROVIDER_DISPLAY_NAMES[String(result.provider).toLowerCase()];

  // Only trust HTTPS report links from the backend — defense in depth against a
  // tampered/compromised response opening a deep link or phishing page.
  const canViewReport = useMemo(
    () =>
      Boolean(result.reportUrl) &&
      uriUtils.parseUrl(result.reportUrl ?? '')?.urlSchema === 'https',
    [result.reportUrl],
  );

  const handleViewReport = useCallback(() => {
    if (!canViewReport || !result.reportUrl) {
      return;
    }
    // The report page is unstable in the in-app WebView, so it opens in the
    // system browser.
    openUrlExternal(result.reportUrl, { useSystemBrowser: true });
  }, [canViewReport, result.reportUrl]);

  const handleCopyAddress = useCallback(() => {
    copyText(result.address);
  }, [copyText, result.address]);

  const handleClose = useCallback(
    (extra?: { flag?: string }) => {
      if (extra?.flag === CONTINUE_SEND_FLAG) {
        void onContinue?.();
      }
    },
    [onContinue],
  );

  const handleContinueAnyway = useCallback<
    NonNullable<IFooterActionsProps['onCancel']>
  >(
    (_close, closePageStack) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.address_risk_check_continue_high_risk__title,
        }),
        description: intl.formatMessage({
          id: ETranslations.address_risk_check_exchange_flag__desc,
        }),
        tone: 'warning',
        icon: 'ErrorOutline',
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_continue,
        }),
        onConfirm: () => {
          closePageStack({ flag: CONTINUE_SEND_FLAG });
        },
      });
    },
    [intl],
  );

  let footer = null;
  if (canContinueToSend) {
    footer = (
      <Page.FooterActions
        onConfirm={continueToSend}
        onConfirmText={intl.formatMessage({
          id: ETranslations.continue_to_send__action,
        })}
        confirmButtonProps={{
          testID: 'address-risk-check-send-action',
        }}
      />
    );
  } else if (isSendFlow && isHighOrSevere) {
    // High may continue after a confirmation; Severe can only go back.
    const continueAnywayProps: Partial<IFooterActionsProps> =
      variant === 'high'
        ? {
            stacked: true,
            onCancel: handleContinueAnyway,
            onCancelText: intl.formatMessage({
              id: ETranslations.global_continue_anyway,
            }),
            cancelButtonProps: {
              testID: 'address-risk-check-continue-anyway-action',
            },
          }
        : {};
    footer = (
      <Page.FooterActions
        onConfirm={backToEdit}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_back })}
        confirmButtonProps={{
          testID: 'address-risk-check-back-action',
        }}
        {...continueAnywayProps}
      />
    );
  }

  return (
    <Page onClose={handleClose}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_risk_check__title,
        })}
      />
      <Page.Body>
        <ScrollView>
          <YStack gap="$5" px="$5" pt="$5" pb="$8">
            <YStack gap="$4">
              <YStack gap="$1">
                <SizableText
                  size="$headingXl"
                  color={KYT_LEVEL_TEXT_COLOR[result.level]}
                  numberOfLines={2}
                >
                  {titleText}
                </SizableText>
                {descriptionText ? (
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {descriptionText}
                  </SizableText>
                ) : null}
                {isHighOrSevere ? (
                  <SizableText size="$bodyMd">
                    {variant === 'severe' ? (
                      <SizableText size="$bodyMdMedium">
                        {severeAdviceText}
                      </SizableText>
                    ) : null}
                    {intl.formatMessage({
                      id: ETranslations.address_risk_check_exchange_flag__desc,
                    })}
                  </SizableText>
                ) : null}
                {isHistoryResult ? (
                  <SizableText size="$bodyMd" color="$textCaution" pt="$1.5">
                    {intl.formatMessage({
                      id: ETranslations.address_risk_check_history_result__desc,
                    })}
                  </SizableText>
                ) : null}
              </YStack>

              {score !== undefined || showExposures ? (
                <YStack
                  p="$4"
                  gap="$4"
                  bg="$bgSubdued"
                  borderRadius="$3"
                  borderCurve="continuous"
                >
                  {score !== undefined ? (
                    <RiskScoreMeter score={score} level={result.level} />
                  ) : null}
                  {score !== undefined && showExposures ? <Divider /> : null}
                  {showExposures ? (
                    <XStack gap="$3">
                      <StatItem
                        label={intl.formatMessage({
                          id: ETranslations.address_risk_check_stats_exposures__title,
                        })}
                        value={String(stats.total)}
                      />
                      <StatItem
                        label={intl.formatMessage({
                          id: ETranslations.address_risk_check_exposure_direct__title,
                        })}
                        value={String(stats.direct)}
                      />
                      <StatItem
                        label={intl.formatMessage({
                          id: ETranslations.address_risk_check_stats_top_exposure__title,
                        })}
                        value={topExposureText}
                        valueNumberOfLines={2}
                      />
                    </XStack>
                  ) : null}
                </YStack>
              ) : null}
            </YStack>

            {showExposures ? (
              <RiskExposureList factors={result.reasons} />
            ) : null}

            <YStack
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
              borderRadius="$3"
              borderCurve="continuous"
              overflow="hidden"
            >
              {network?.name ? (
                <>
                  <CardRow
                    label={intl.formatMessage({
                      id: ETranslations.global_network,
                    })}
                  >
                    <XStack
                      ai="center"
                      jc="flex-end"
                      gap="$1.5"
                      maxWidth="70%"
                      flexShrink={1}
                    >
                      <NetworkAvatar networkId={result.networkId} size="$5" />
                      <SizableText
                        size="$bodyMdMedium"
                        textAlign="right"
                        numberOfLines={1}
                        flexShrink={1}
                      >
                        {network.name}
                      </SizableText>
                    </XStack>
                  </CardRow>
                  <Divider />
                </>
              ) : null}

              <CardRow
                label={intl.formatMessage({
                  id: ETranslations.global_address,
                })}
              >
                <XStack
                  ai="center"
                  jc="flex-end"
                  gap="$1"
                  maxWidth="70%"
                  flexShrink={1}
                >
                  <SizableText
                    size="$bodyMdMedium"
                    numberOfLines={2}
                    textAlign="right"
                    flexShrink={1}
                    style={
                      platformEnv.isNative
                        ? undefined
                        : { wordBreak: 'break-all' }
                    }
                  >
                    {result.address}
                  </SizableText>
                  <IconButton
                    testID="address-risk-check-copy-address"
                    title={intl.formatMessage({
                      id: ETranslations.global_copy_address,
                    })}
                    variant="tertiary"
                    size="small"
                    iconSize="$4"
                    icon="Copy3Outline"
                    onPress={handleCopyAddress}
                  />
                </XStack>
              </CardRow>

              <Divider />
              <CardRow
                label={intl.formatMessage({
                  id: ETranslations.kyt_last_checked__title,
                })}
              >
                <SizableText
                  size="$bodyMdMedium"
                  textAlign="right"
                  numberOfLines={1}
                  flexShrink={1}
                >
                  {checkedAtText}
                </SizableText>
              </CardRow>
              {canViewReport ? (
                <>
                  <Divider />
                  <XStack
                    testID="address-risk-check-view-report"
                    role="button"
                    px="$4"
                    py="$2.5"
                    ai="center"
                    jc="space-between"
                    gap="$2"
                    userSelect="none"
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    onPress={handleViewReport}
                  >
                    <SizableText size="$bodyMd">
                      {intl.formatMessage({
                        id: ETranslations.kyt_view_report__action,
                      })}
                    </SizableText>
                    <Icon
                      name="ArrowTopRightOutline"
                      size="$4"
                      color="$iconSubdued"
                    />
                  </XStack>
                </>
              ) : null}
            </YStack>

            {showMoreAnalysis ? (
              <AddressRiskMoreAnalysis
                networkId={result.networkId}
                address={result.address}
              />
            ) : null}

            <SizableText size="$bodySm" color="$textSubdued">
              {providerName
                ? intl.formatMessage(
                    {
                      id: ETranslations.address_risk_check_source_disclaimer__desc,
                    },
                    { provider: providerName },
                  )
                : intl.formatMessage({
                    id: ETranslations.address_risk_check_disclaimer__desc,
                  })}
            </SizableText>
          </YStack>
        </ScrollView>
      </Page.Body>
      {footer ? <Page.Footer>{footer}</Page.Footer> : null}
    </Page>
  );
}

function AddressRiskCheckPending({ isFailed }: { isFailed: boolean }) {
  const intl = useIntl();
  const { isInternetReachable } = useNetInfo();
  const messageIds = getAddressRiskCheckPendingMessageIds({
    isFailed,
    isInternetReachable,
  });

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_risk_check__title,
        })}
      />
      <Page.Body>
        <YStack
          minHeight={320}
          flex={1}
          alignItems="center"
          justifyContent="center"
          gap="$5"
          px="$5"
          py="$8"
        >
          {isFailed ? (
            <Illustration size={110} name="XMark" />
          ) : (
            <LottieView
              source={require('@onekeyhq/kit/assets/animations/swap_order_pending.json')}
              width={110}
              height={110}
              autoPlay
              loop
            />
          )}
          <YStack gap="$2" alignItems="center" maxWidth={360}>
            <SizableText size="$headingLg" textAlign="center">
              {intl.formatMessage({
                id: messageIds.title,
              })}
            </SizableText>
            <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
              {intl.formatMessage({
                id: messageIds.description,
              })}
            </SizableText>
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

function AddressRiskCheckResult() {
  const route =
    useRoute<
      RouteProp<
        IModalAddressRiskCheckParamList,
        EModalAddressRiskCheckRoutes.AddressRiskCheckResult
      >
    >();
  const { checkRequest, showMoreAnalysis, onContinue } = route.params;
  const { result, isHistoryResult, isFailed } =
    useAddressRiskCheckRequest(checkRequest);

  if (!result) {
    return <AddressRiskCheckPending isFailed={isFailed} />;
  }

  return (
    <AddressRiskCheckResultContent
      result={result}
      showMoreAnalysis={showMoreAnalysis}
      onContinue={onContinue}
      isHistoryResult={isHistoryResult}
    />
  );
}

export default AddressRiskCheckResult;
