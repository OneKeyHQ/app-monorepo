import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import type { IEarnText, IEarnTooltip } from '@onekeyhq/shared/types/staking';

import { CircleProgress } from './CircleProgress';

interface ICapUsageChartProps {
  percentage: string;
  label: string;
  title: IEarnText;
  description: IEarnText;
  tooltip?: IEarnTooltip;
}

export function CapUsageChart({
  percentage,
  label,
  title,
  description,
  tooltip,
}: ICapUsageChartProps) {
  const percentageValue = parseFloat(percentage) || 0;

  return (
    <XStack gap="$3" ai="center">
      <CircleProgress percentage={percentageValue} size={64} strokeWidth={4} />
      <YStack gap="$1.5" flex={1}>
        <XStack ai="center" gap="$1.5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {label}
          </SizableText>
          {tooltip ? <EarnTooltip title={label} tooltip={tooltip} /> : null}
        </XStack>
        <XStack ai="center" gap="$3">
          <EarnText text={title} size="$bodyLgMedium" />
          <EarnText text={description} size="$bodySm" color="$textSubdued" />
        </XStack>
      </YStack>
    </XStack>
  );
}
