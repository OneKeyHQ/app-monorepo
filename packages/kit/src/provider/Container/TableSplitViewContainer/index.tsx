import { Divider, XStack, YStack, useIsSplitView } from '@onekeyhq/components';
import { useIsOnBoardingOpenAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export function TableSplitViewContainer({
  mainRouter,
  detailRouter,
}: {
  mainRouter: React.ReactNode;
  detailRouter: React.ReactNode;
}) {
  const isLandscape = useIsSplitView();
  const [isOnBoardingOpen] = useIsOnBoardingOpenAtom();
  const display = isLandscape && !isOnBoardingOpen ? 'flex' : 'none';
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
