import { Button, IconButton, Stack } from '@onekeyhq/components';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';

import useWebTabAction from '../../hooks/useWebTabAction';

function MobileBrowserBottomBar({
  goBack,
  goForward,
  canGoBack,
  canGoForward,
  tabCount,
  onShowTabList,
}: {
  id: string;
  tabCount: number;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  onShowTabList: () => void;
}) {
  const { bottom } = useSafeAreaInsets();

  const { addBlankWebTab } = useWebTabAction();

  return (
    <Stack bg="$bgActiveDark" height="$14" zIndex={1} display="flex">
      <Stack
        flex={1}
        flexDirection="row"
        overflow="hidden"
        mb={`${bottom}px`}
        alignItems="center"
        justifyContent="space-between"
      >
        <IconButton
          icon="ArrowLeftOutline"
          disabled={!canGoBack}
          onPress={goBack}
        />
        <IconButton
          icon="ArrowTopOutline"
          disabled={!canGoForward}
          onPress={goForward}
        />
        <IconButton icon="PlusLargeOutline" onPress={() => addBlankWebTab()} />
        <Button
          onPress={() => {
            onShowTabList();
          }}
        >
          {tabCount}
        </Button>
        <IconButton
          icon="PlusLargeOutline"
          onPress={() => console.log('show more menu')}
        />
      </Stack>
    </Stack>
  );
}

export default MobileBrowserBottomBar;
