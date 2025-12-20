import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';

function TokenGroupSkeleton() {
  return (
    <XStack>
      {[0, 1, 2].map((i) => (
        <Stack
          key={i}
          w="$5"
          h="$5"
          borderRadius="$full"
          borderColor="$neutral3"
          bg="$bgStrong"
          overflow="hidden"
          {...(i !== 0 && { ml: '$-1.5' })}
        >
          <Skeleton w="$5" h="$5" />
        </Stack>
      ))}
    </XStack>
  );
}

export function MarketBannerItemSkeleton() {
  return (
    <Stack
      flexDirection="column"
      bg="$bgSubdued"
      borderRadius="$3"
      px="$3"
      py="$4"
      width="$32"
      alignItems="flex-start"
      justifyContent="space-between"
      h={118}
      $gtMd={{
        flexDirection: 'row',
        flex: 1,
        flexBasis: 0,
        minWidth: 180,
        maxWidth: 256,
        width: 'auto',
        h: '100%',
        p: '$4',
        gap: '$3',
        alignItems: 'center',
      }}
    >
      <YStack gap="$0.5" flex={1} $gtMd={{ flex: 1 }}>
        <Skeleton w="$16" h="$3" $gtMd={{ w: '$20', h: '$4' }} />
        <Skeleton w="$10" h="$3" $gtMd={{ w: '$12' }} />
      </YStack>
      <TokenGroupSkeleton />
    </Stack>
  );
}
