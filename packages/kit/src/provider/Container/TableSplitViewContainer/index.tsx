import { Divider, XStack, YStack } from '@onekeyhq/components';

export function TableSplitViewContainer({
  mainRouter,
  detailRouter,
}: {
  mainRouter: React.ReactNode;
  detailRouter: React.ReactNode;
}) {
  return (
    <XStack flex={1}>
      <YStack flex={1}>{mainRouter}</YStack>
      <Divider vertical />
      <YStack flex={1}>{detailRouter}</YStack>
    </XStack>
  );
}
