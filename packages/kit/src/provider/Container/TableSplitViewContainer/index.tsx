import { Divider, XStack, YStack, useIsSplitView } from '@onekeyhq/components';

export function TableSplitViewContainer({
  mainRouter,
  detailRouter,
}: {
  mainRouter: React.ReactNode;
  detailRouter: React.ReactNode;
}) {
  const isLandscape = useIsSplitView();
  const display = isLandscape ? 'flex' : 'none';
  return (
    <XStack flex={1}>
      <YStack flex={1} display={display}>
        {mainRouter}
      </YStack>
      <Divider vertical display={display} />
      <YStack flex={1}>{detailRouter}</YStack>
    </XStack>
  );
}
