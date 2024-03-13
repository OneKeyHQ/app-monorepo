import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { Freeze } from 'react-freeze';
import Animated from 'react-native-reanimated';

import { Page, Stack, XStack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDiscoveryModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDiscoveryModalRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

import CustomHeaderTitle from '../../components/CustomHeaderTitle';
import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import HeaderRightToolBar from '../../components/HeaderRightToolBar';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
import useMobileBottomBarAnimation from '../../hooks/useMobileBottomBarAnimation';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { checkAndCreateFolder } from '../../utils/screenshot';
import DashboardContent from '../Dashboard/DashboardContent';

import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

function MobileBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  // const { tab } = useWebTabDataById(activeTabId ?? '');
  const navigation =
    useAppNavigation<IPageNavigationProp<IDiscoveryModalParamList>>();
  const { handleScroll, toolbarAnimatedStyle } =
    useMobileBottomBarAnimation(activeTabId);
  useDAppNotifyChanges({ tabId: activeTabId });

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
    void checkAndCreateFolder();
  }, []);

  const content = useMemo(
    () =>
      tabs.map((t) => (
        <MobileBrowserContent id={t.id} key={t.id} onScroll={handleScroll} />
      )),
    [tabs, handleScroll],
  );

  const handleSearchBarPress = useCallback(() => {
    navigation.pushFullModal(EModalRoutes.DiscoveryModal, {
      screen: EDiscoveryModalRoutes.SearchModal,
    });
  }, [navigation]);
  return (
    <Page>
      <Page.Header headerShown={false} />
      <XStack pt={platformEnv.isNativeIOS ? '$16' : 0} mx="$5">
        <CustomHeaderTitle handleSearchBarPress={handleSearchBarPress} />
        <HeaderRightToolBar />
      </XStack>
      <Page.Body>
        <Stack flex={1} zIndex={3}>
          <HandleRebuildBrowserData />
          {displayHomePage ? (
            <Stack flex={1}>
              <DashboardContent onScroll={handleScroll} />
            </Stack>
          ) : null}
          <Stack pt="$3">
            <Freeze freeze={displayHomePage}>{content}</Freeze>
          </Stack>
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
