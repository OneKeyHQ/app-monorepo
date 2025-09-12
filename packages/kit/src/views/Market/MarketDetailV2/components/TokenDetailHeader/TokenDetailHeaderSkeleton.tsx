import { Skeleton, View, XStack, YStack } from '@onekeyhq/components';

function SkeletonHeader() {
  return (
    <YStack>
      <Skeleton w="$24" h="$4" />
      <View pt="$5" pb="$3.5">
        <Skeleton w="$40" h="$7" />
      </View>
      <Skeleton w="$24" h="$3" />
    </YStack>
  );
}

function SkeletonHeaderOverItemItem() {
  return (
    <YStack gap="$2" flexGrow={1} flexBasis={0}>
      <Skeleton w="$10" h="$3" />
      <Skeleton w="$24" h="$3" />
    </YStack>
  );
}

interface ITokenDetailHeaderSkeletonProps {
  gtMd: boolean;
}

export function TokenDetailHeaderSkeleton({
  gtMd,
}: ITokenDetailHeaderSkeletonProps) {
  return (
    <YStack px="$5">
      {gtMd ? (
        <YStack gap="$12" width={392}>
          <SkeletonHeader />
          <YStack gap="$3">
            <Skeleton w={252} h="$3" />
          </YStack>
          <YStack gap="$6">
            <XStack>
              <SkeletonHeaderOverItemItem />
              <SkeletonHeaderOverItemItem />
            </XStack>
            <XStack>
              <SkeletonHeaderOverItemItem />
              <SkeletonHeaderOverItemItem />
            </XStack>
            <XStack>
              <SkeletonHeaderOverItemItem />
              <SkeletonHeaderOverItemItem />
            </XStack>
          </YStack>
          <YStack gap="$6">
            <Skeleton w="$10" h="$3" />
            <Skeleton w={252} h="$3" />
            <Skeleton w={252} h="$3" />
            <Skeleton w={252} h="$3" />
          </YStack>
        </YStack>
      ) : (
        <YStack gap="$6" pt="$1">
          <SkeletonHeader />
          <XStack>
            <SkeletonHeaderOverItemItem />
            <SkeletonHeaderOverItemItem />
            <SkeletonHeaderOverItemItem />
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
