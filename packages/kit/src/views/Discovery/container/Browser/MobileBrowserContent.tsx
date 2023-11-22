import { useCallback, useMemo, useState } from 'react';

import { Freeze } from 'react-freeze';
import { Stack } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebContent from '../../components/WebContent/WebContent';
import useBrowserHistoryAction from '../../hooks/useBrowserHistoryAction';
import { useActiveTabId, useWebTabData } from '../../hooks/useWebTabs';
import { homeTab } from '../../store/contextWebTabs';
import { captureViewRefs } from '../../utils/explorerUtils';
import DiscoveryDashboard from '../Dashboard';

import type { WebViewScrollEvent } from 'react-native-webview/lib/WebViewTypes';

function MobileBrowserContent({
  id,
  onScroll,
}: {
  id: string;
  onScroll?: (event: WebViewScrollEvent) => void;
}) {
  const { tab } = useWebTabData(id);
  const { addBrowserHistory } = useBrowserHistoryAction();
  const { activeTabId } = useActiveTabId();
  const [backEnabled, setBackEnabled] = useState(false);
  const [forwardEnabled, setForwardEnabled] = useState(false);

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
          <Stack
            ref={initCaptureViewRef}
            flex={1}
            // https://github.com/gre/react-native-view-shot/issues/7
            collapsable={platformEnv.isNativeAndroid ? false : undefined}
            bg={platformEnv.isNativeAndroid ? '$bgApp' : undefined}
          >
            <WebContent
              id={tab.id}
              url={tab.url}
              isCurrent={isActive}
              setBackEnabled={setBackEnabled}
              setForwardEnabled={setForwardEnabled}
              addBrowserHistory={(siteInfo) => {
                addBrowserHistory(siteInfo);
              }}
              onScroll={onScroll}
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
