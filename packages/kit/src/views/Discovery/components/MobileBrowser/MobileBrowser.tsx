import { memo, useEffect, useMemo, useState } from 'react';

import { Freeze } from 'react-freeze';
import { Stack } from 'tamagui';

import {
  homeTab,
  withProviderWebTabs,
} from '../../container/Context/contextWebTabs';
import DiscoveryDashboard from '../../container/Dashboard';
import {
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
  const isActive = useMemo(
    () => activeTabId === tab?.id,
    [tab?.id, activeTabId],
  );
  const BrowserBottomBar = useMemo(
    () => (
      <Freeze key={tab.id} freeze={!isActive}>
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

  useEffect(() => {
    console.log('===>backEnabled: ', backEnabled);
    console.log('===>forwardEnabled: ', forwardEnabled);
    console.log('tab url => : ', tab.url);
  }, [backEnabled, forwardEnabled, tab]);

  const content = useMemo(() => {
    if (!tab || !tab.id) {
      return null;
    }
    console.log('RERENDER WEBVIEW ====>: ', tab);
    return (
      <Freeze key={tab.id} freeze={!isActive}>
        <WebContent
          {...tab}
          setBackEnabled={setBackEnabled}
          setForwardEnabled={setForwardEnabled}
        />
      </Freeze>
    );
  }, [tab, isActive]);
  return (
    <>
      {content}
      {BrowserBottomBar}
    </>
  );
}

function MobileBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();
  const { tab } = useWebTabData(activeTabId ?? '');
  const showHome = useMemo(() => {
    if (!activeTabId) {
      return true;
    }
    return tab?.url === homeTab.url;
  }, [tab?.url, activeTabId]);

  useEffect(() => {
    console.log('showHome: ', showHome);
  }, [showHome]);

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
          top="$10"
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

export default memo(withProviderWebTabs(MobileBrowser));
