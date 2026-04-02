import {
  Divider,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IStakeEarnDetail } from '@onekeyhq/shared/types/staking';

import { EarnText } from './EarnText';
import { EarnTooltip } from './EarnTooltip';
import { PendlePtConvergenceChart } from './PendlePtConvergenceChart';

function RuleItem({
  item,
  isLast,
}: {
  item: NonNullable<IStakeEarnDetail['rules']>['items'][number];
  isLast: boolean;
}) {
  return (
    <XStack gap="$3">
      {/* Indicator: dot + connecting line */}
      <YStack ai="center" w={20} alignSelf="stretch">
        <Stack h={20} jc="center" ai="center">
          <Stack w={8} h={8} borderRadius="$full" bg="$iconDisabled" />
        </Stack>
        {!isLast ? (
          <Stack flex={1} w={1} bg="$iconDisabled" borderRadius="$full" />
        ) : null}
      </YStack>
      {/* Content */}
      <XStack
        gap="$1"
        ai="flex-start"
        flexWrap="wrap"
        flex={1}
        pb="$3"
        minHeight={20}
      >
        <EarnText text={item.title} size="$bodyMd" color="$textSubdued" />
        <EarnText text={item.description} size="$bodyMdMedium" />
        {item.tooltip ? <EarnTooltip tooltip={item.tooltip} /> : null}
      </XStack>
    </XStack>
  );
}

export function PendleRulesSection({
  data,
}: {
  data?: IStakeEarnDetail['rules'];
}) {
  if (!data?.items?.length) {
    return null;
  }

  return (
    <>
      <YStack gap="$6">
        <EarnText text={data.title} size="$headingLg" />
        <YStack>
          {data.items.map((item, index) => (
            <RuleItem
              key={index}
              item={item}
              isLast={index === data.items.length - 1}
            />
          ))}
        </YStack>
        {data.chart?.description ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {data.chart.description}
          </SizableText>
        ) : null}
        {data.chart ? <PendlePtConvergenceChart chart={data.chart} /> : null}
      </YStack>
      <Divider />
    </>
  );
}
