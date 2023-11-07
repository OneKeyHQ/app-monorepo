import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { Freeze } from 'react-freeze';
import { Stack } from 'tamagui';

import { usePromiseResult } from '../../../../hooks/usePromiseResult';
import {
  addBlankWebTabAtom,
  homeTab,
  setCurrentWebTabAtom,
  setWebTabsAtom,
  useAtomWebTabs,
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
import { simpleDb } from '../WebView/mock';

import MobileBrowserBottomBar from './MobileBrowserBottomBar';
import MobileBrowserInfoBar from './MobileBrowserInfoBar';

import type { IWebTab } from '../../types';
import type WebView from 'react-native-webview';

function WebContentWithFreeze({ id }: { id: string }) {
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

  useEffect(() => {
    console.log('===>backEnabled: ', backEnabled);
    console.log('===>forwardEnabled: ', forwardEnabled);
    console.log('tab url => : ', tab.url);
  }, [backEnabled, forwardEnabled, tab]);

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

export function useTabBarDataFromSimpleDb() {
  const result = usePromiseResult(async () => {
    const r = await simpleDb.discoverWebTabs.getRawData();
    return (r?.tabs as IWebTab[]) || [];
  }, []);

  return result;
}

function HandleRebuildTabBarData() {
  const result = useTabBarDataFromSimpleDb();
  const [, setWebTabsData] = useAtomWebTabs(setWebTabsAtom);
  const [, setCurrentWebTab] = useAtomWebTabs(setCurrentWebTabAtom);
  const [, addBlankWebTab] = useAtomWebTabs(addBlankWebTabAtom);
  useEffect(() => {
    console.log('HandleRebuildTabBarData renderer ===> : ');
  }, []);

  useEffect(() => {
    if (!result.result) return;
    console.log(
      'HandleRebuildTabBarData hooks renderer ===> : ',
      result.result,
    );
    const data = result.result;
    if (data && Array.isArray(data) && data.length > 0) {
      setWebTabsData(data);
    } else {
      addBlankWebTab();
    }
  }, [result.result, setWebTabsData, setCurrentWebTab, addBlankWebTab]);

  return null;
}

function MobileBrowser() {
  const { tabs } = useWebTabs();
  const { activeTabId } = useActiveTabId();

  useEffect(() => {
    console.log('MobileBrowser renderer ===> : ');
  }, []);

  const content = useMemo(
    () => tabs.map((t) => <WebContentWithFreeze id={t.id} key={t.id} />),
    [tabs],
  );

  return (
    <Stack flex={1} zIndex={3}>
      <HandleRebuildTabBarData />
      <MobileBrowserInfoBar id={activeTabId ?? ''} />
      {content}
    </Stack>
  );
}

export default memo(withProviderWebTabs(MobileBrowser));
