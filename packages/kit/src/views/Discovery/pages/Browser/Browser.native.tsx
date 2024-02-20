import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { Freeze } from 'react-freeze';
import Animated from 'react-native-reanimated';

import { Page, Stack } from '@onekeyhq/components';
import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { useBrowserTabActions } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';

import { CustomHeaderTitle } from '../../components/CustomHeaderTitle';
import { HandleRebuildBrowserData } from '../../components/HandleData/HandleRebuildBrowserTabData';
import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar';
import MobileBrowserInfoBar from '../../components/MobileBrowser/MobileBrowserInfoBar';
import { useDAppNotifyChanges } from '../../hooks/useDAppNotifyChanges';
import useMobileBottomBarAnimation from '../../hooks/useMobileBottomBarAnimation';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useWebTabDataById,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import { checkAndCreateFolder } from '../../utils/screenshot';
import DashboardContent from '../Dashboard/DashboardContent';

import MobileBrowserContent from './MobileBrowserContent';
import { withBrowserProvider } from './WithBrowserProvider';

import type { IDiscoveryModalParamList } from '../../router/Routes';

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
  const headerTitle = useCallback(
    () => <CustomHeaderTitle handleSearchBarPress={handleSearchBarPress} />,
    [handleSearchBarPress],
  );

  return (
    <Page>
      <Page.Header headerTitle={headerTitle} />
      <Page.Body>
        <Stack flex={1} zIndex={3}>
          <HandleRebuildBrowserData />
          {displayHomePage ? (
            <Stack flex={1}>
              <DashboardContent onScroll={handleScroll} />
            </Stack>
          ) : // <MobileBrowserInfoBar
          //   id={activeTabId ?? ''}
          //   url={tab?.url ?? ''}
          //   onSearch={() => {
          //     navigation.pushModal(EModalRoutes.DiscoveryModal, {
          //       screen: EDiscoveryModalRoutes.SearchModal,
          //       params: {
          //         useCurrentWindow: true,
          //         tabId: tab?.id,
          //       },
          //     });
          //   }}
          // />
          null}
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
