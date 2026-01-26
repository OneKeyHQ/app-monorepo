import { useMemo } from 'react';

import { SizableText, XStack, YStack, useMedia } from '@onekeyhq/components';
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
  const media = useMedia();

  const labelRender = useMemo(() => {
    if (media.gtSm) {
      return (
        <XStack ai="center" gap="$3">
          <EarnText text={title} size="$bodyLgMedium" />
          <EarnText text={description} size="$bodySm" color="$textSubdued" />
        </XStack>
      );
    }
    return (
      <YStack jc="center" gap="$1.5">
        <EarnText text={title} size="$bodyLgMedium" />
        <EarnText text={description} size="$bodySm" color="$textSubdued" />
      </YStack>
    );
  }, [title, media.gtSm, description]);

  return (
    <XStack gap="$3.5" ai="center" py="$2">
      <CircleProgress percentage={percentageValue} size={80} strokeWidth={6} />
      <YStack gap="$1.5" flex={1}>
        <XStack ai="center" gap="$1.5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {label}
          </SizableText>
          {tooltip ? <EarnTooltip title={label} tooltip={tooltip} /> : null}
        </XStack>
        {labelRender}
      </YStack>
    </XStack>
  );
}
