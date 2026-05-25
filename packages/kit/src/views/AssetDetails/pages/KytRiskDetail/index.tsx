import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';

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
import type { IBadgeType } from '@onekeyhq/components/src/content/Badge';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EKytRiskLevel } from '@onekeyhq/shared/types/kyt';
import type { IKytRiskFactor } from '@onekeyhq/shared/types/kyt';

import type { RouteProp } from '@react-navigation/core';

const LEVEL_BADGE_MAP: Record<string, IBadgeType> = {
  [EKytRiskLevel.Low]: 'success',
  [EKytRiskLevel.Moderate]: 'warning',
  [EKytRiskLevel.High]: 'critical',
  [EKytRiskLevel.Severe]: 'critical',
};

const LEVEL_CONTENT: Record<string, { title: string; description: string }> = {
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
    description:
      'Severe fund-source risk was detected for this incoming transfer.',
  },
};

function OverviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <XStack py="$2.5" ai="center" jc="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      {children}
    </XStack>
  );
}

function FactorRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack py="$1.5" ai="center" jc="space-between">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMd">{value}</SizableText>
    </XStack>
  );
}

function RiskFactorCard({ factor }: { factor: IKytRiskFactor }) {
  return (
    <YStack bg="$bgSubdued" borderRadius="$3" px="$3.5" py="$2.5" gap="$0.5">
      <SizableText size="$bodyMdMedium">{factor.category}</SizableText>
      {factor.entity ? (
        <FactorRow label="Entity" value={factor.entity} />
      ) : null}
      {factor.exposureType ? (
        <FactorRow label="Exposure" value={factor.exposureType} />
      ) : null}
      {factor.hops !== undefined ? (
        <FactorRow label="Distance" value={`${factor.hops} hops`} />
      ) : null}
      {factor.amountUsd || factor.percent ? (
        <FactorRow
          label="Exposure / Share"
          value={[factor.amountUsd, factor.percent].filter(Boolean).join(' / ')}
        />
      ) : null}
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

  const badgeType = useMemo(
    () => LEVEL_BADGE_MAP[riskDetail.level] ?? ('default' as IBadgeType),
    [riskDetail.level],
  );

  const levelLabel = useMemo(() => {
    const map: Record<string, string> = {
      [EKytRiskLevel.Low]: 'Low',
      [EKytRiskLevel.Moderate]: 'Moderate',
      [EKytRiskLevel.High]: 'High',
      [EKytRiskLevel.Severe]: 'Severe',
    };
    return map[riskDetail.level] ?? riskDetail.level;
  }, [riskDetail.level]);

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
          <YStack px="$5" pb="$10" gap="$5">
            <YStack gap="$2">
              <Heading size="$headingLg">{content.title}</Heading>
              <SizableText size="$bodyLg" color="$textSubdued">
                {content.description}
              </SizableText>
            </YStack>

            <YStack
              borderWidth={1}
              borderColor="$borderSubdued"
              borderRadius="$3"
              px="$3.5"
              py="$1"
            >
              <OverviewRow label="Risk level">
                <Badge badgeType={badgeType} badgeSize="sm">
                  {levelLabel}
                </Badge>
              </OverviewRow>
              <Divider />
              <OverviewRow label="Last checked">
                <SizableText size="$bodyMd">{riskDetail.checkedAt}</SizableText>
              </OverviewRow>
              <Divider />
              <OverviewRow label="Asset">
                <XStack ai="center" gap="$2">
                  <Token
                    size="sm"
                    tokenImageUri={riskDetail.asset.tokenImageUri}
                  />
                  <SizableText size="$bodyMd">
                    {riskDetail.asset.symbol}
                  </SizableText>
                  <Badge badgeType="default" badgeSize="sm">
                    {riskDetail.asset.networkName}
                  </Badge>
                </XStack>
              </OverviewRow>
              <Divider />
              <OverviewRow label="Transfer">
                <SizableText size="$bodyMd">
                  {riskDetail.transferAmount}
                </SizableText>
              </OverviewRow>
            </YStack>

            {riskDetail.factors.length > 0 ? (
              <YStack gap="$3">
                <XStack ai="center" jc="space-between">
                  <SizableText size="$bodyMdMedium">Risk factors</SizableText>
                  <SizableText size="$bodyMd" color="$textSubdued">
                    {riskDetail.factors.length} found
                  </SizableText>
                </XStack>
                {visibleFactors.map((factor, index) => (
                  <RiskFactorCard key={index} factor={factor} />
                ))}
                {hasMoreFactors && !showAllFactors ? (
                  <XStack>
                    <SizableText
                      size="$bodyMd"
                      color="$textSuccess"
                      cursor="pointer"
                      onPress={() => setShowAllFactors(true)}
                    >
                      Show more
                    </SizableText>
                  </XStack>
                ) : null}
              </YStack>
            ) : null}

            {riskDetail.reportUrl ? (
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
            ) : null}

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
