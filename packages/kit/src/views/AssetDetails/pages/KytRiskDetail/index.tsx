import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  Heading,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IKytRiskFactor } from '@onekeyhq/shared/types/kyt';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';

import type { RouteProp } from '@react-navigation/core';

const LEVEL_TEXT_COLOR: Record<string, ColorTokens> = {
  [EKytRiskLevel.None]: '$textSuccess',
  [EKytRiskLevel.Checking]: '$textSubdued',
  [EKytRiskLevel.Failed]: '$textSubdued',
  [EKytRiskLevel.Low]: '$textSuccess',
  [EKytRiskLevel.Moderate]: '$textCaution',
  [EKytRiskLevel.High]: '$textCaution',
  [EKytRiskLevel.Severe]: '$textCritical',
};

const LEVEL_LABEL: Partial<Record<EKytRiskLevel, ETranslations>> = {
  [EKytRiskLevel.None]: ETranslations.kyt_risk_level_none__title,
  [EKytRiskLevel.Checking]: ETranslations.kyt_risk_level_checking__title,
  [EKytRiskLevel.Failed]: ETranslations.global_failed,
  [EKytRiskLevel.Low]: ETranslations.kyt_risk_level_low__title,
  [EKytRiskLevel.Moderate]: ETranslations.kyt_risk_level_moderate__title,
  [EKytRiskLevel.High]: ETranslations.kyt_risk_level_high__title,
  [EKytRiskLevel.Severe]: ETranslations.kyt_risk_level_severe__title,
};

const DEFAULT_LEVEL_CONTENT = {
  title: ETranslations.kyt_risk_check_failed__title,
  description: ETranslations.kyt_risk_check_failed__desc,
};

const LEVEL_CONTENT: Partial<
  Record<EKytRiskLevel, { title: ETranslations; description: ETranslations }>
> = {
  [EKytRiskLevel.None]: {
    title: ETranslations.kyt_no_significant_risk_detected__title,
    description: ETranslations.kyt_no_significant_risk_detected__desc,
  },
  [EKytRiskLevel.Checking]: {
    title: ETranslations.kyt_risk_level_checking__desc,
    description: ETranslations.kyt_risk_checking_detail__desc,
  },
  [EKytRiskLevel.Failed]: {
    title: ETranslations.kyt_risk_check_failed__title,
    description: ETranslations.kyt_risk_check_failed__desc,
  },
  [EKytRiskLevel.Low]: {
    title: ETranslations.kyt_low_risk_detected__title,
    description: ETranslations.kyt_low_risk_detail__desc,
  },
  [EKytRiskLevel.Moderate]: {
    title: ETranslations.kyt_moderate_risk_detected__title,
    description: ETranslations.kyt_moderate_risk_detail__desc,
  },
  [EKytRiskLevel.High]: {
    title: ETranslations.kyt_high_risk_detected__title,
    description: ETranslations.kyt_high_risk_detail__desc,
  },
  [EKytRiskLevel.Severe]: {
    title: ETranslations.kyt_severe_risk_detected__title,
    description: ETranslations.kyt_severe_risk_detail__desc,
  },
};

function CardRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <XStack px="$4" py="$2.5" ai="center" jc="space-between" gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

function RiskFactorCard({ factor }: { factor: IKytRiskFactor }) {
  const intl = useIntl();
  const rows: { label: string; value: string }[] = [];
  if (factor.entity) {
    rows.push({
      label: intl.formatMessage({
        id: ETranslations.kyt_risk_factor_entity__title,
      }),
      value: factor.entity,
    });
  }
  if (factor.exposureType) {
    rows.push({
      label: intl.formatMessage({
        id: ETranslations.kyt_risk_factor_exposure_type__title,
      }),
      value: factor.exposureType,
    });
  }
  if (factor.hops !== undefined) {
    rows.push({
      label: intl.formatMessage({
        id: ETranslations.kyt_risk_factor_distance__title,
      }),
      value: intl.formatMessage(
        { id: ETranslations.kyt_risk_factor_distance_hops__msg },
        { count: factor.hops },
      ),
    });
  }
  const amountText =
    factor.amountUsd !== undefined
      ? `$${new BigNumber(factor.amountUsd).toFormat(2)}`
      : undefined;
  const percentText =
    factor.percent !== undefined
      ? `${new BigNumber(factor.percent).toFixed(2)}%`
      : undefined;
  if (amountText) {
    rows.push({
      label: intl.formatMessage({
        id: ETranslations.kyt_risk_factor_exposure_amount__title,
      }),
      value: amountText,
    });
  }
  if (percentText) {
    rows.push({
      label: intl.formatMessage({
        id: ETranslations.kyt_risk_factor_share__title,
      }),
      value: percentText,
    });
  }

  return (
    <YStack
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      overflow="hidden"
    >
      <XStack px="$4" py="$2.5" bg="$bgSubdued">
        <SizableText size="$bodyMdMedium">{factor.category}</SizableText>
      </XStack>
      {rows.map((row) => (
        <YStack key={row.label}>
          <Divider />
          <CardRow label={row.label}>
            <SizableText size="$bodyMdMedium" textAlign="right">
              {row.value}
            </SizableText>
          </CardRow>
        </YStack>
      ))}
    </YStack>
  );
}

function KytRiskDetail() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.KytRiskDetail
      >
    >();

  const { riskDetail } = route.params;
  const [showAllFactors, setShowAllFactors] = useState(false);

  const content = useMemo(
    () => LEVEL_CONTENT[riskDetail.level] ?? DEFAULT_LEVEL_CONTENT,
    [riskDetail.level],
  );
  const levelLabel =
    LEVEL_LABEL[riskDetail.level] ?? ETranslations.global_unknown;

  const visibleFactors = useMemo(() => {
    if (showAllFactors) return riskDetail.factors;
    return riskDetail.factors.slice(0, 1);
  }, [riskDetail.factors, showAllFactors]);

  const hasMoreFactors = riskDetail.factors.length > 1;

  const handleViewReport = useCallback(() => {
    if (riskDetail.reportUrl) {
      openUrlExternal(riskDetail.reportUrl);
    }
  }, [riskDetail.reportUrl]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.kyt_source_of_funds_risk_check__title,
        })}
      />
      <Page.Body>
        <ScrollView>
          <YStack px="$5" py="$3" gap="$1.5">
            <Heading size="$headingXl">
              {intl.formatMessage({ id: content.title })}
            </Heading>
            <SizableText size="$bodyLg">
              {intl.formatMessage({ id: content.description })}
            </SizableText>
          </YStack>

          <YStack px="$5" pb="$5" gap="$2">
            {/* Overview */}
            <YStack
              borderWidth={1}
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              <CardRow
                label={intl.formatMessage({
                  id: ETranslations.kyt_risk_level__title,
                })}
              >
                <SizableText
                  size="$bodyMdMedium"
                  color={LEVEL_TEXT_COLOR[riskDetail.level] ?? '$text'}
                  textAlign="right"
                >
                  {intl.formatMessage({ id: levelLabel })}
                </SizableText>
              </CardRow>
              <Divider />
              <CardRow
                label={intl.formatMessage({
                  id: ETranslations.kyt_last_checked__title,
                })}
              >
                <SizableText size="$bodyMdMedium" textAlign="right">
                  {riskDetail.checkedAt}
                </SizableText>
              </CardRow>
              <Divider />
              <CardRow
                label={intl.formatMessage({ id: ETranslations.global_asset })}
              >
                <XStack ai="center" gap="$1.5">
                  <Token
                    size="sm"
                    tokenImageUri={riskDetail.asset.tokenImageUri}
                  />
                  <SizableText size="$bodyMdMedium">
                    {riskDetail.asset.symbol}
                  </SizableText>
                  <Badge badgeType="default" badgeSize="sm">
                    {riskDetail.asset.networkName}
                  </Badge>
                </XStack>
              </CardRow>
              <Divider />
              <CardRow
                label={intl.formatMessage({
                  id: ETranslations.kyt_transfer__title,
                })}
              >
                <SizableText size="$bodyMdMedium" textAlign="right">
                  {riskDetail.transferAmount}
                </SizableText>
              </CardRow>
            </YStack>

            {/* Risk Factors */}
            {riskDetail.factors.length > 0 ? (
              <YStack gap="$1">
                <XStack ai="center" jc="space-between" py="$2">
                  <SizableText size="$headingSm" color="$textSubdued">
                    {intl.formatMessage({
                      id: ETranslations.kyt_risk_factors__title,
                    })}
                  </SizableText>
                  <SizableText size="$bodyMdMedium" color="$textSubdued">
                    {intl.formatMessage(
                      { id: ETranslations.kyt_risk_factors_found__msg },
                      { count: riskDetail.factors.length },
                    )}
                  </SizableText>
                </XStack>
                <YStack gap="$1">
                  {visibleFactors.map((factor, index) => (
                    <RiskFactorCard key={index} factor={factor} />
                  ))}
                </YStack>
                {hasMoreFactors ? (
                  <XStack py="$2">
                    <SizableText
                      size="$bodyMdMedium"
                      color="$textSuccess"
                      cursor="pointer"
                      onPress={() => setShowAllFactors((v) => !v)}
                    >
                      {intl.formatMessage({
                        id: showAllFactors
                          ? ETranslations.global_show_less
                          : ETranslations.global_show_more,
                      })}
                    </SizableText>
                  </XStack>
                ) : null}
              </YStack>
            ) : null}
          </YStack>

          {/* Footer */}
          <YStack px="$5" pb="$5" gap="$2.5">
            <Button
              testID="kyt-view-report"
              variant="secondary"
              size="large"
              icon="ArrowTopRightOutline"
              iconAfter
              onPress={handleViewReport}
            >
              {intl.formatMessage({
                id: ETranslations.kyt_view_report__action,
              })}
            </Button>
            <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.kyt_result_disclaimer__desc,
              })}
            </SizableText>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default KytRiskDetail;
