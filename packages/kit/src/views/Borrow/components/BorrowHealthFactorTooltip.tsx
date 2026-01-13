import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowHealthFactorRiskDetail } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

import { HealthFactor } from './HealthFactor';

type IHealthFactorDetail =
  IBorrowHealthFactorRiskDetail['data']['healthFactorDetail'];

type IBorrowHealthFactorTooltipProps = {
  detail?: IHealthFactorDetail;
};

export const BorrowHealthFactorTooltip = ({
  detail,
}: IBorrowHealthFactorTooltipProps) => {
  const intl = useIntl();
  const { value, displayValue, index, lowerLimit, upperLimit } = useMemo(() => {
    const numericValue = Number(detail?.value);
    return {
      value: Number.isFinite(numericValue) ? numericValue : 0,
      displayValue: detail?.value ?? '-',
      index: detail?.index ? Number(detail.index) : undefined,
      lowerLimit: Number(detail?.lowerLimit) || 0,
      upperLimit: Number(detail?.upperLimit) || 3,
    };
  }, [detail?.index, detail?.lowerLimit, detail?.upperLimit, detail?.value]);
  const gradientStops = useMemo(() => {
    if (!detail?.gradientStops?.length) return undefined;
    const parsedStops = detail.gradientStops
      .map((stop) => ({
        percent: stop.percent,
        level: stop.level,
      }))
      .filter((stop) => Number.isFinite(stop.percent));
    return parsedStops.length ? parsedStops : undefined;
  }, [detail?.gradientStops]);
  const healthFactorLabel = intl.formatMessage({
    id: ETranslations.defi_health_factor,
  });
  const detailsLabel = intl.formatMessage({ id: ETranslations.global_details });

  const valueColor = useMemo(() => {
    const badgeType = detail?.status?.badge;
    if (badgeType === 'success') {
      return '$textSuccess';
    }
    if (badgeType === 'critical') {
      return '$textCritical';
    }
    return '$textCaution';
  }, [detail?.status?.badge]);

  if (!detail) return null;

  return (
    <Popover
      placement="bottom"
      title={healthFactorLabel}
      renderTrigger={
        <XStack cursor="pointer" ai="center" gap="$1">
          <EarnText
            size="$bodySmMedium"
            color="$textSubdued"
            text={{ text: detailsLabel }}
          />
          <Icon size="$4" name="InfoCircleOutline" color="$iconSubdued" />
        </XStack>
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
              size="$bodySm"
              color="$textSubdued"
              text={detail.statusDescription}
            />
          ) : null}

          {/* Health Factor progress bar */}
          <HealthFactor
            value={value}
            displayValue={displayValue}
            index={index}
            min={lowerLimit}
            max={upperLimit}
            thresholdValue={1}
            liquidationText={detail.liquidationAt?.description}
            gradientStops={gradientStops}
          />

          {/* Liquidation description */}
          {detail.liquidationAtDescription ? (
            <EarnText
              size="$bodySm"
              color="$textSubdued"
              text={detail.liquidationAtDescription}
            />
          ) : null}
        </YStack>
      }
    />
  );
};
