import { useMemo, useState } from 'react';

import { Freeze } from 'react-freeze';
import { Stack } from 'tamagui';

import { homeTab } from '../../container/Context/contextWebTabs';
import DiscoveryDashboard from '../../container/Dashboard';
import { useActiveTabId, useWebTabData } from '../../hooks/useWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import { onItemSelect } from '../../utils/gotoSite';
import WebContent from '../WebContent/WebContent';

import MobileBrowserBottomBar from './MobileBrowserBottomBar';

import type WebView from 'react-native-webview';

function MobileBrowserContent({ id }: { id: string }) {
  const { tab } = useWebTabData(id);
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
  const BrowserBottomBar = useMemo(
    () => (
      <Freeze key={`${tab.id}-BottomBar`} freeze={!isActive}>
        <MobileBrowserBottomBar
          id={tab.id}
          goBack={() => {
            (webviewRefs[tab.id]?.innerRef as WebView)?.goBack();
          }}
          goForward={() => {
            (webviewRefs[tab.id]?.innerRef as WebView)?.goForward();
          }}
          canGoBack={backEnabled}
          canGoForward={forwardEnabled}
        />
      </Freeze>
    ),
    [tab.id, backEnabled, forwardEnabled, isActive],
  );

  const content = useMemo(() => {
    if (!tab || !tab.id) {
      return null;
    }
    return (
      <>
        <Freeze freeze={!showHome}>
          <Stack flex={1}>
            <DiscoveryDashboard onItemSelect={onItemSelect} />
          </Stack>
        </Freeze>
        <Freeze key={tab.id} freeze={!isActive}>
          <WebContent
            id={tab.id}
            url={tab.url}
            isCurrent={isActive}
            setBackEnabled={setBackEnabled}
            setForwardEnabled={setForwardEnabled}
          />
        </Freeze>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isActive, showHome]);
  return (
    <>
      {content}
      {BrowserBottomBar}
    </>
  );
}

export default MobileBrowserContent;
