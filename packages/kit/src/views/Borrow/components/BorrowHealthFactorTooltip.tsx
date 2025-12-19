import { useMemo } from 'react';

import { Icon, Popover, Stack, XStack } from '@onekeyhq/components';
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
  const { value, lowerLimit, upperLimit } = useMemo(() => {
    return {
      value: Number(detail?.value) || 0,
      lowerLimit: Number(detail?.lowerLimit) || 0,
      upperLimit: Number(detail?.upperLimit) || 3,
    };
  }, [detail?.lowerLimit, detail?.upperLimit, detail?.value]);

  if (!detail) return null;

  return (
    <Popover
      placement="top"
      title=""
      renderTrigger={
        <XStack cursor="pointer" ai="center">
          <EarnText
            size="$bodySmMedium"
            color="$textSubdued"
            text={{ text: 'Details' }}
          />
          <Icon
            size="$bodySmMedium"
            name="ChevronDownSmallOutline"
            color="$iconSubdued"
          />
        </XStack>
      }
      renderContent={
        <Stack p="$4" w={280} gap="$3">
          <HealthFactor
            value={value}
            min={lowerLimit}
            max={upperLimit}
            thresholdValue={1}
          />
          {detail.statusDescription ? (
            <EarnText
              size="$bodySm"
              color="$textSubdued"
              text={detail.statusDescription}
            />
          ) : null}
          {detail.liquidationAt?.description ? (
            <EarnText
              size="$bodySm"
              color="$textSubdued"
              text={detail.liquidationAt.description}
            />
          ) : null}
          {detail.liquidationAtDescription ? (
            <EarnText
              size="$bodySm"
              color="$textSubdued"
              text={detail.liquidationAtDescription}
            />
          ) : null}
        </Stack>
      }
    />
  );
};
