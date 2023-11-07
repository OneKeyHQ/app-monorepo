import { Button, IconButton, Stack } from '@onekeyhq/components';
import type { PageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';

import useWebTabAction from '../../hooks/useWebTabAction';
import { useWebTabs } from '../../hooks/useWebTabs';
import {
  type DiscoverModalParamList,
  DiscoverModalRoutes,
} from '../../router/Routes';

function MobileBrowserBottomBar({
  id,
  goBack,
  goForward,
  canGoBack,
  canGoForward,
}: {
  id: string;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}) {
  const navigation =
    useAppNavigation<PageNavigationProp<DiscoverModalParamList>>();
  const { bottom } = useSafeAreaInsets();

  const { tabs } = useWebTabs();
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
          onPress={() =>
            navigation.pushModal(ModalRoutes.DiscoverModal, {
              screen: DiscoverModalRoutes.MobileTabList,
            })
          }
        >
          {tabs.length}
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
