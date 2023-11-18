import { useCallback, useMemo, useRef, useState } from 'react';

import { Freeze } from 'react-freeze';
import { captureRef } from 'react-native-view-shot';
import { Stack } from 'tamagui';

import type { IPageNavigationProp } from '@onekeyhq/components/src/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Root/Modal/Routes';

import MobileBrowserBottomBar from '../../components/MobileBrowser/MobileBrowserBottomBar-1';
import WebContent from '../../components/WebContent/WebContent';
import { THUMB_HEIGHT, THUMB_WIDTH } from '../../config/TabList.constants';
import useBrowserBookmarkAction from '../../hooks/useBrowserBookmarkAction';
import useBrowserHistoryAction from '../../hooks/useBrowserHistoryAction';
import useWebTabAction from '../../hooks/useWebTabAction';
import {
  useActiveTabId,
  useWebTabData,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { EDiscoveryModalRoutes } from '../../router/Routes';
import { homeTab } from '../../store/contextWebTabs';
import { captureViewRefs, webviewRefs } from '../../utils/explorerUtils';
import { getScreenshotPath, saveScreenshot } from '../../utils/screenshot';
import DiscoveryDashboard from '../Dashboard';

import type { IDiscoveryModalParamList } from '../../router/Routes';
import type WebView from 'react-native-webview';
import type { TamaguiElement } from 'tamagui';

function MobileBrowserContent({ id }: { id: string }) {
  const { tab } = useWebTabData(id);
  const { addBrowserHistory } = useBrowserHistoryAction();
  const { activeTabId } = useActiveTabId();
  const [backEnabled, setBackEnabled] = useState(false);
  const [forwardEnabled, setForwardEnabled] = useState(false);
  const captureViewRef = useRef<TamaguiElement | null>();

  const isActive = useMemo(
    () => activeTabId === tab?.id,
    [tab?.id, activeTabId],
  );
  const showHome = useMemo(
    () => isActive && tab?.url === homeTab.url,
    [isActive, tab?.url],
  );

  const initCaptureViewRef = useCallback(
    ($ref: any) => {
      captureViewRef.current = $ref;
      captureViewRefs[id] = $ref;
    },
    [id],
  );

  const content = useMemo(() => {
    if (!tab || !tab?.id) {
      return null;
    }
    return (
      <>
        <Freeze freeze={!showHome}>
          <Stack flex={1}>
            <DiscoveryDashboard />
          </Stack>
        </Freeze>
        <Freeze key={tab.id} freeze={!isActive}>
          <Stack ref={initCaptureViewRef} flex={1}>
            <WebContent
              id={tab.id}
              url={tab.url}
              isCurrent={isActive}
              setBackEnabled={setBackEnabled}
              setForwardEnabled={setForwardEnabled}
              addBrowserHistory={(siteInfo) => {
                addBrowserHistory(siteInfo);
              }}
            />
          </Stack>
        </Freeze>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isActive, showHome]);
  return <>{content}</>;
}

export default MobileBrowserContent;
