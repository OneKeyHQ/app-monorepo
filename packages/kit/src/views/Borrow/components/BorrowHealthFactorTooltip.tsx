import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  IconButton,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { ColorTokens } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowHealthFactorRiskDetail } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { BorrowTestIDs } from '../testIDs';

import { HealthFactor } from './HealthFactor';

export type IHealthFactorDetail =
  IBorrowHealthFactorRiskDetail['data']['healthFactorDetail'];

type IBorrowHealthFactorTooltipProps = {
  detail?: IHealthFactorDetail;
};

export function resolveHealthFactorValueColor(
  detail?: IHealthFactorDetail,
): ColorTokens {
  if (detail?.valueColor) {
    return detail.valueColor;
  }
  const badgeType = detail?.status?.badge;
  if (badgeType === 'success') {
    return '$textSuccess';
  }
  if (badgeType === 'critical') {
    return '$textCritical';
  }
  return '$textCaution';
}

function parseHealthFactorBarProps(detail?: IHealthFactorDetail): {
  value: number;
  index?: number;
  thresholdIndex?: number;
  min: number;
  max: number;
  gradientStops?: IHealthFactorDetail['gradientStops'];
} {
  const numericValue = Number(detail?.value);
  const numericIndex = Number(detail?.index);
  const numericLiquidationIndex = Number(detail?.liquidationAtIndex);
  const stops = (detail?.gradientStops ?? []).filter((stop) =>
    Number.isFinite(stop.percent),
  );
  return {
    value: Number.isFinite(numericValue) ? numericValue : 0,
    index: Number.isFinite(numericIndex) ? numericIndex : undefined,
    thresholdIndex: Number.isFinite(numericLiquidationIndex)
      ? numericLiquidationIndex
      : undefined,
    min: Number(detail?.lowerLimit) || 0,
    max: Number(detail?.upperLimit) || 3,
    gradientStops: stops.length ? stops : undefined,
  };
}

export const BorrowHealthFactorTooltip = ({
  detail,
}: IBorrowHealthFactorTooltipProps) => {
  const intl = useIntl();
  const barProps = useMemo(() => parseHealthFactorBarProps(detail), [detail]);
  const healthFactorLabel = intl.formatMessage({
    id: ETranslations.defi_health_factor,
  });

  const valueColor = useMemo(
    () => resolveHealthFactorValueColor(detail),
    [detail],
  );

  if (!detail) return null;

  return (
    <Popover
      placement="bottom"
      title={healthFactorLabel}
      renderTrigger={
        <IconButton
          testID={BorrowTestIDs.overviewHealthFactorInfoBtn}
          title={healthFactorLabel}
          accessibilityLabel={healthFactorLabel}
          icon="InfoCircleOutline"
          size="small"
          variant="tertiary"
          iconColor="$iconSubdued"
        />
      }
      renderContent={
        <YStack p="$4" gap="$3">
          {/* Header: Health factor + value + Badge */}
          <XStack jc="space-between" ai="center">
            <XStack ai="center" gap="$2">
              <SizableText size="$headingMd">{healthFactorLabel}</SizableText>
              <SizableText size="$headingMd" color={valueColor}>
                {detail.value}
              </SizableText>
            </XStack>
            {detail.status ? (
              <Badge badgeType={detail.status.badge}>{detail.status.tag}</Badge>
            ) : null}
          </XStack>

          {/* Status description */}
          {detail.statusDescription ? (
            <EarnText
              size="$bodyMd"
              color="$textSubdued"
              text={detail.statusDescription}
            />
          ) : null}

          {/* Health Factor progress bar */}
          <HealthFactor
            {...barProps}
            valueColor={valueColor}
            thresholdValue={1}
            liquidationText={detail.liquidationAt?.description}
          />

          {/* Liquidation description */}
          {detail.liquidationAtDescription ? (
            <EarnText
              size="$bodyMd"
              color="$textSubdued"
              text={detail.liquidationAtDescription}
            />
          ) : null}
        </YStack>
      }
    />
  );
};
