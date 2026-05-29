import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';

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

const LEVEL_LABEL: Record<string, string> = {
  [EKytRiskLevel.None]: 'None',
  [EKytRiskLevel.Checking]: 'Checking',
  [EKytRiskLevel.Failed]: 'Failed',
  [EKytRiskLevel.Low]: 'Low',
  [EKytRiskLevel.Moderate]: 'Moderate',
  [EKytRiskLevel.High]: 'High',
  [EKytRiskLevel.Severe]: 'Severe',
};

const LEVEL_CONTENT: Record<string, { title: string; description: string }> = {
  [EKytRiskLevel.None]: {
    title: 'No risk detected',
    description:
      'No significant fund-source risk was found for this incoming transfer.',
  },
  [EKytRiskLevel.Checking]: {
    title: 'Checking fund-source risk',
    description:
      'This incoming transfer is still being checked for fund-source risk.',
  },
  [EKytRiskLevel.Failed]: {
    title: 'Risk check failed',
    description:
      'We were unable to check fund-source risk for this incoming transfer.',
  },
  [EKytRiskLevel.Low]: {
    title: 'Low risk detected',
    description: 'No significant high-risk fund-source exposure was found.',
  },
  [EKytRiskLevel.Moderate]: {
    title: 'Moderate risk detected',
    description:
      'Some fund-source risk was detected for this incoming transfer.',
  },
  [EKytRiskLevel.High]: {
    title: 'High risk detected',
    description:
      'High-risk fund-source exposure was detected for this incoming transfer.',
  },
  [EKytRiskLevel.Severe]: {
    title: 'Severe risk detected',
    description: 'This incoming transfer is linked to high-risk fund sources.',
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
  const rows: { label: string; value: string }[] = [];
  if (factor.entity) {
    rows.push({ label: 'Entity', value: factor.entity });
  }
  if (factor.exposureType) {
    rows.push({ label: 'Exposure', value: factor.exposureType });
  }
  if (factor.hops !== undefined) {
    rows.push({ label: 'Distance', value: `${factor.hops} hops` });
  }
  const amountText =
    factor.amountUsd !== undefined
      ? `$${new BigNumber(factor.amountUsd).toFormat(2)}`
      : undefined;
  const percentText =
    factor.percent !== undefined
      ? `${new BigNumber(factor.percent).toFixed(2)}%`
      : undefined;
  if (amountText || percentText) {
    rows.push({
      label: 'Exposure / Share',
      value: [amountText, percentText].filter(Boolean).join(' / '),
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
    () => LEVEL_CONTENT[riskDetail.level] ?? LEVEL_CONTENT[EKytRiskLevel.Low],
    [riskDetail.level],
  );

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
      <Page.Header title="Fund-source risk check" />
      <Page.Body>
        <ScrollView>
          <YStack px="$5" py="$3" gap="$1.5">
            <Heading size="$headingXl">{content.title}</Heading>
            <SizableText size="$bodyLg">{content.description}</SizableText>
          </YStack>

          <YStack px="$5" pb="$5" gap="$2">
            {/* Overview */}
            <YStack
              borderWidth={1}
              borderColor="$borderSubdued"
              borderRadius="$3"
              overflow="hidden"
            >
              <CardRow label="Risk level">
                <SizableText
                  size="$bodyMdMedium"
                  color={LEVEL_TEXT_COLOR[riskDetail.level] ?? '$text'}
                  textAlign="right"
                >
                  {LEVEL_LABEL[riskDetail.level] ?? riskDetail.level}
                </SizableText>
              </CardRow>
              <Divider />
              <CardRow label="Last checked">
                <SizableText size="$bodyMdMedium" textAlign="right">
                  {riskDetail.checkedAt}
                </SizableText>
              </CardRow>
              <Divider />
              <CardRow label="Asset">
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
              <CardRow label="Transfer">
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
                    Risk factors
                  </SizableText>
                  <SizableText size="$bodyMdMedium" color="$textSubdued">
                    {riskDetail.factors.length} found
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
                      {showAllFactors ? 'Show less' : 'Show more'}
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
              View report
            </Button>
            <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
              Risk results are informational and do not block incoming
              transfers.
            </SizableText>
          </YStack>
        </ScrollView>
      </Page.Body>
    </Page>
  );
}

export default KytRiskDetail;
