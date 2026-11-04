import { SizableText, Skeleton, XStack, YStack } from '@onekeyhq/components';

export function StakingAmountInputSkeleton({ title }: { title: string }) {
  return (
    <YStack borderRadius="$3" bg="$bgSubdued" px="$3.5" py="$2.5" gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued">
        {title}
      </SizableText>
      <XStack h="$11" ai="center">
        <Skeleton h="$6" w="$24" borderRadius="$2" />
      </XStack>
      <XStack ai="center">
        <Skeleton h="$3" w="$16" borderRadius="$2" />
      </XStack>
    </YStack>
  );
}
