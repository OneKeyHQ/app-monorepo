import { Skeleton, XStack, YStack } from '@onekeyhq/components';

import type { holderLayout } from '../holderTable';

export function HoldersSkeleton({
  layout,
}: {
  layout: ReturnType<typeof holderLayout>;
}) {
  return (
    <YStack px={layout.padding}>
      {Array.from({ length: 10 }, (_, i) => (
        <XStack
          key={i}
          height={layout.wide ? 40 : 52}
          alignItems="center"
          gap={layout.gap}
        >
          <YStack width={layout.rankWidth}>
            <Skeleton height={16} width={18} />
          </YStack>
          <YStack
            flex={layout.wide ? undefined : 1}
            width={layout.addressWidth}
          >
            <Skeleton height={16} width="80%" />
          </YStack>
          <YStack width={layout.percentageWidth} alignItems="flex-end">
            <Skeleton height={16} width={40} />
          </YStack>
          {layout.wide ? (
            <YStack width={layout.amountWidth} alignItems="flex-end">
              <Skeleton height={16} width={72} />
            </YStack>
          ) : null}
          <YStack width={layout.valueWidth} alignItems="flex-end">
            <Skeleton height={16} width={64} />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}
