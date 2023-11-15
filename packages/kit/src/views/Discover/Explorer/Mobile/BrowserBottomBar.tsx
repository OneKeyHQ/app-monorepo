import { useEffect } from 'react';

import { Button, IconButton, Stack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';

import { useWebController } from '../../Controller/useWebController';
import { type DiscoverModalParamList, DiscoverModalRoutes } from '../../types';
import { homeTab, useWebTabsActions } from '../Context/contextWebTabs';

function BrowserBottomBar({ showHome }: { showHome?: () => void }) {
  const actions = useWebTabsActions();
  const navigation =
    useAppNavigation<IPageNavigationProp<DiscoverModalParamList>>();
  const { currentTab, goBack, goForward } = useWebController();
  const { bottom } = useSafeAreaInsets();
  const { canGoForward, url } = currentTab ?? {};
  const { tabs } = actions.getWebTabs();

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
          onPress={() => actions.addBlankWebTab()}
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
