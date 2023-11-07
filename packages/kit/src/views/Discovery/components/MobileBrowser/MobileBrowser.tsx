import { memo, useMemo, useState } from 'react';

import { Freeze } from 'react-freeze';
import { Stack } from 'tamagui';

import { homeTab } from '../../container/Context/contextWebTabs';
import DiscoveryDashboard from '../../container/Dashboard';
import {
  getWebTabs,
  useActiveTabId,
  useWebTabData,
  useWebTabs,
} from '../../hooks/useWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import { onItemSelect } from '../../utils/gotoSite';
import WebContent from '../WebContent/WebContent';

import MobileBrowserBottomBar from './MobileBrowserBottomBar';

import type { IWebTab } from '../../types';
import type WebView from 'react-native-webview';

function WebContentWithFreeze({ tab: webTab }: { tab: IWebTab }) {
  const { tab } = useWebTabData(webTab.id);
  const { activeTabId } = useActiveTabId();
  const [backEnabled, setBackEnabled] = useState(false);
  const [forwardEnabled, setForwardEnabled] = useState(false);
  const isActive = useMemo(() => activeTabId === tab.id, [tab.id, activeTabId]);
  const content = useMemo(
    () => (
      <Freeze key={tab.id} freeze={!isActive}>
        <WebContent
          {...tab}
          setBackEnabled={setBackEnabled}
          setForwardEnabled={setForwardEnabled}
        />
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
    [tab, isActive, backEnabled, forwardEnabled],
  );
  return <>{content}</>;
}

function MobileBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const showHome = useMemo(() => {
    if (!activeTabId) {
      return true;
    }
    const { tab } = getWebTabs(activeTabId);
    return tab?.url === homeTab.url;
  }, [activeTabId]);

  const content = useMemo(
    () => tabs.map((t) => <WebContentWithFreeze tab={t} key={t.id} />),
    [tabs],
  );

  return (
    <Stack flex={1} zIndex={3}>
      {content}
      <Freeze freeze={!showHome}>
        <Stack
          position="absolute"
          top="$0"
          bottom="$14"
          left="$0"
          right="$0"
          backgroundColor="$bg"
          zIndex={1}
        >
          <DiscoveryDashboard onItemSelect={onItemSelect} />
        </Stack>
      </Freeze>
    </Stack>
  );
}

export default memo(MobileBrowser);
