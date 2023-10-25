import { useEffect } from 'react';

import { StyleSheet } from 'react-native';

import { Button, IconButton, Stack } from '@onekeyhq/components';
import useSafeAreaInsets from '@onekeyhq/components/src/Provider/hooks/useSafeAreaInsets';

import { useWebController } from '../../Controller/useWebController';
import { homeTab, webTabsActions } from '../Context/contextWebTabs';

function BrowserBottomBar({ showHome }: { showHome?: () => void }) {
  const { currentTab, goBack, goForward } = useWebController();
  const { bottom } = useSafeAreaInsets();
  const { canGoForward, url } = currentTab ?? {};

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
        <Button onPress={() => console.log('go to tabs')}>5</Button>
        <IconButton
          icon="PlusLargeOutline"
          onPress={() => console.log('show more menu')}
        />
      </Stack>
    </Stack>
  );
}

export default BrowserBottomBar;
