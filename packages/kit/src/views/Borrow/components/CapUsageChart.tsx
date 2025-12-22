import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import type { IEarnText, IEarnTooltip } from '@onekeyhq/shared/types/staking';

import { CircleProgress } from './CircleProgress';

interface ICapUsageChartProps {
  percentage: string;
  title: IEarnText;
  description: IEarnText;
  fiatDescription?: string;
  tooltip?: IEarnTooltip;
}

export function CapUsageChart({
  percentage,
  title,
  description,
  fiatDescription,
  tooltip,
}: ICapUsageChartProps) {
  const percentageValue = parseFloat(percentage) || 0;

  return (
    <XStack gap="$3" ai="center">
      <CircleProgress percentage={percentageValue} size={64} strokeWidth={4} />
      <YStack gap="$0.5">
        <XStack ai="center" gap="$1">
          <EarnText text={title} size="$bodyMd" color="$textSubdued" />
          <EarnTooltip title={title.text} tooltip={tooltip} />
        </XStack>
        <EarnText text={description} size="$bodyLgMedium" />
        {fiatDescription ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {fiatDescription}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}
