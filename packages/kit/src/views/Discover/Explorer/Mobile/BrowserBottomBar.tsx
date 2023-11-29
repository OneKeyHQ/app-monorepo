import { useEffect } from 'react';

import {
  Button,
  IconButton,
  Stack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';

import { useWebController } from '../../Controller/useWebController';
import { useWebTabs } from '../../Controller/useWebTabs';
import { type DiscoverModalParamList, DiscoverModalRoutes } from '../../types';
import { homeTab, webTabsActions } from '../Context/contextWebTabs';

function BrowserBottomBar({ showHome }: { showHome?: () => void }) {
  const navigation =
    useAppNavigation<IPageNavigationProp<DiscoverModalParamList>>();
  const { currentTab, goBack, goForward } = useWebController();
  const { bottom } = useSafeAreaInsets();
  const { canGoForward, url } = currentTab ?? {};
  const { tabs } = useWebTabs();

  useEffect(() => {
    if (url === homeTab.url) {
      showHome?.();
    }
  }, [url, showHome]);

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
          disabled={currentTab?.url === homeTab.url}
          onPress={goBack}
        />
        <IconButton
          icon="ArrowTopOutline"
          disabled={!canGoForward}
          onPress={goForward}
        />
        <IconButton
          icon="PlusLargeOutline"
          onPress={() => webTabsActions.addBlankWebTab()}
        />
        <Button
          onPress={() =>
            navigation.pushModal(EModalRoutes.DiscoverModal, {
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

export default BrowserBottomBar;
