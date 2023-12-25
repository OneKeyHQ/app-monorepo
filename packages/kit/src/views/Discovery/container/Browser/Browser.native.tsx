import { memo, useEffect, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { Freeze } from 'react-freeze';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Page, Stack, Text } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import MobileBrowserInfoBar from '../../components/MobileBrowser/MobileBrowserInfoBar';
import useMobileBottomBarAnimation from '../../hooks/useMobileBottomBarAnimation';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import { checkAndCreateFolder } from '../../utils/screenshot';
import Dashboard from '../Dashboard';

import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

import type { IDiscoveryModalParamList } from '../../router/Routes';

function MobileBrowser() {
  const navigationCore = useNavigation();
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabDataById(activeTabId ?? '');
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { handleScroll, toolbarAnimatedStyle } =
    useMobileBottomBarAnimation(activeTabId);

  const { displayHomePage } = useDisplayHomePageFlag();

  const displayBottomBar = useMemo(() => {
    if (!displayHomePage) return true;
    if (displayHomePage && tabs.length > 0) return true;
    return false;
  }, [displayHomePage, tabs]);

  const { setDisplayHomePage } = useBrowserTabActions().current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (!firstRender.current && tabs.length === 0) {
      setDisplayHomePage(true);
    }
    if (firstRender.current) {
      firstRender.current = false;
    }
  }, [tabs, navigation, setDisplayHomePage]);

  useEffect(() => {
    navigationCore.setOptions({
      headerShown: false,
      animation: 'none',
    });
    void checkAndCreateFolder();
  }, [navigationCore]);

  const content = useMemo(
    () =>
      tabs.map((t) => (
        <MobileBrowserContent id={t.id} key={t.id} onScroll={handleScroll} />
      )),
    [tabs, handleScroll],
  );
  const { top } = useSafeAreaInsets();

  return (
    <Page>
      <Page.Body>
        <Stack flex={1} zIndex={3} pt={top}>
          <HandleRebuildBrowserData />
          {displayHomePage ? (
            <Stack flex={1}>
              <Dashboard />
            </Stack>
          ) : (
            <MobileBrowserInfoBar
              id={activeTabId ?? ''}
              url={tab?.url ?? ''}
              onSearch={() => {
                navigation.pushModal(EModalRoutes.DiscoveryModal, {
                  screen: EDiscoveryModalRoutes.SearchModal,
                  params: {
                    useCurrentWindow: true,
                    tabId: tab?.id,
                  },
                });
              }}
            />
          )}
          <Freeze freeze={displayHomePage}>{content}</Freeze>
          <Freeze freeze={!displayBottomBar}>
            <Animated.View
              style={[
                toolbarAnimatedStyle,
                {
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                },
              ]}
            >
              <MobileBrowserBottomBar id={activeTabId ?? ''} />
            </Animated.View>
          </Freeze>
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default memo(withBrowserProvider(MobileBrowser));
