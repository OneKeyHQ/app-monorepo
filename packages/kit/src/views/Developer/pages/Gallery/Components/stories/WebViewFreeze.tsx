import { useCallback, useEffect, useMemo, useState } from 'react';

import { Freeze } from 'react-freeze';
import { View as RNView, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';

import {
  Button,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import WebView from '@onekeyhq/kit/src/components/WebView';

type IWebViewFreezeDemoTabId = 'alpha' | 'beta' | 'gamma';
type IWebViewFreezeDemoOuterPageId = 'market' | 'earn' | 'browser';

type IWebViewFreezeDemoCounterKey =
  | 'mounts'
  | 'unmounts'
  | 'loadStarts'
  | 'loadEnds';

type IWebViewFreezeDemoStats = Record<
  IWebViewFreezeDemoTabId,
  {
    mounts: number;
    unmounts: number;
    loadStarts: number;
    loadEnds: number;
    lastEventAt: number;
    lastEventName: string;
  }
>;

type IWebViewFreezeDemoTab = {
  id: IWebViewFreezeDemoTabId;
  label: string;
  src: string;
};

const WEBVIEW_FREEZE_DEMO_TABS: IWebViewFreezeDemoTab[] = [
  {
    id: 'alpha',
    label: 'Google A',
    src: 'https://www.google.com/?onekey_gallery_freeze=alpha',
  },
  {
    id: 'beta',
    label: 'Google B',
    src: 'https://www.google.com/?onekey_gallery_freeze=beta',
  },
  {
    id: 'gamma',
    label: 'Google C',
    src: 'https://www.google.com/?onekey_gallery_freeze=gamma',
  },
];

const OUTER_PAGES: {
  id: IWebViewFreezeDemoOuterPageId;
  label: string;
}[] = [
  { id: 'market', label: 'Market' },
  { id: 'earn', label: 'Earn' },
  { id: 'browser', label: 'Browser' },
];

const buildInitialStats = (): IWebViewFreezeDemoStats => ({
  alpha: {
    mounts: 0,
    unmounts: 0,
    loadStarts: 0,
    loadEnds: 0,
    lastEventAt: 0,
    lastEventName: '',
  },
  beta: {
    mounts: 0,
    unmounts: 0,
    loadStarts: 0,
    loadEnds: 0,
    lastEventAt: 0,
    lastEventName: '',
  },
  gamma: {
    mounts: 0,
    unmounts: 0,
    loadStarts: 0,
    loadEnds: 0,
    lastEventAt: 0,
    lastEventName: '',
  },
});

const styles = StyleSheet.create({
  webViewHost: {
    flex: 1,
    minHeight: 360,
  },
  fullLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  inactiveLayer: {
    opacity: 0,
  },
  activeLayer: {
    opacity: 1,
  },
  viewShot: {
    flex: 1,
  },
});

function DemoPlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Stack
      flex={1}
      alignItems="center"
      justifyContent="center"
      bg="$bgSubdued"
      p="$5"
      gap="$2"
    >
      <SizableText size="$headingLg">{title}</SizableText>
      <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
        {description}
      </SizableText>
    </Stack>
  );
}

function WebViewFreezeDemoPane({
  active,
  sessionKey,
  tab,
  useViewShot,
  onCounter,
}: {
  active: boolean;
  sessionKey: number;
  tab: IWebViewFreezeDemoTab;
  useViewShot: boolean;
  onCounter: (
    tabId: IWebViewFreezeDemoTabId,
    counter: IWebViewFreezeDemoCounterKey,
  ) => void;
}) {
  useEffect(() => {
    onCounter(tab.id, 'mounts');
    return () => onCounter(tab.id, 'unmounts');
  }, [onCounter, tab.id]);

  const webview = (
    <WebView
      key={`${sessionKey}-${tab.id}`}
      id={`gallery-freeze-${tab.id}`}
      src={tab.src}
      disableBridge
      skipBackgroundBridge
      pullToRefreshEnabled={false}
      allowsBackForwardNavigationGestures={false}
      onLoadStart={() => onCounter(tab.id, 'loadStarts')}
      onLoadEnd={() => onCounter(tab.id, 'loadEnds')}
    />
  );

  return (
    <RNView
      pointerEvents={active ? 'auto' : 'none'}
      style={[
        styles.fullLayer,
        active ? styles.activeLayer : styles.inactiveLayer,
      ]}
    >
      {useViewShot ? (
        <ViewShot style={styles.viewShot}>{webview}</ViewShot>
      ) : (
        webview
      )}
    </RNView>
  );
}

export default function WebViewFreezeGallery() {
  const [activeOuterPageId, setActiveOuterPageId] =
    useState<IWebViewFreezeDemoOuterPageId>('browser');
  const [activeTabId, setActiveTabId] =
    useState<IWebViewFreezeDemoTabId>('alpha');
  const [mountedTabIds, setMountedTabIds] = useState<IWebViewFreezeDemoTabId[]>(
    ['alpha'],
  );
  const [outerFreezeEnabled, setOuterFreezeEnabled] = useState(false);
  const [homeFreezeEnabled, setHomeFreezeEnabled] = useState(false);
  const [innerFreezeEnabled, setInnerFreezeEnabled] = useState(false);
  const [viewShotEnabled, setViewShotEnabled] = useState(false);
  const [showHomePage, setShowHomePage] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [stats, setStats] =
    useState<IWebViewFreezeDemoStats>(buildInitialStats);

  const mountTab = useCallback((tabId: IWebViewFreezeDemoTabId) => {
    setMountedTabIds((prev) =>
      prev.includes(tabId) ? prev : [...prev, tabId],
    );
  }, []);

  useEffect(() => {
    setMountedTabIds(['alpha']);
    setActiveOuterPageId('browser');
    setShowHomePage(false);
  }, [sessionKey]);

  const recordCounter = useCallback(
    (tabId: IWebViewFreezeDemoTabId, counter: IWebViewFreezeDemoCounterKey) => {
      setStats((prev) => ({
        ...prev,
        [tabId]: {
          ...prev[tabId],
          [counter]: prev[tabId][counter] + 1,
          lastEventAt: Date.now(),
          lastEventName: counter,
        },
      }));
    },
    [],
  );

  const activeTab = useMemo(
    () => WEBVIEW_FREEZE_DEMO_TABS.find((tab) => tab.id === activeTabId),
    [activeTabId],
  );

  const resetDemo = useCallback(() => {
    setActiveTabId('alpha');
    setOuterFreezeEnabled(false);
    setHomeFreezeEnabled(false);
    setInnerFreezeEnabled(false);
    setViewShotEnabled(false);
    setShowHomePage(false);
    setStats(buildInitialStats());
    setSessionKey((value) => value + 1);
  }, []);

  const selectTab = useCallback(
    (tabId: IWebViewFreezeDemoTabId) => {
      mountTab(tabId);
      setActiveTabId(tabId);
      setActiveOuterPageId('browser');
      setShowHomePage(false);
    },
    [mountTab],
  );

  const mountAllTabs = useCallback(() => {
    setMountedTabIds(WEBVIEW_FREEZE_DEMO_TABS.map((tab) => tab.id));
  }, []);

  const webViewTabsLayer = (
    <RNView style={styles.fullLayer}>
      {WEBVIEW_FREEZE_DEMO_TABS.filter((tab) =>
        mountedTabIds.includes(tab.id),
      ).map((tab) => (
        <Freeze
          key={tab.id}
          freeze={innerFreezeEnabled && activeTabId !== tab.id}
        >
          <WebViewFreezeDemoPane
            active={activeTabId === tab.id && !showHomePage}
            sessionKey={sessionKey}
            tab={tab}
            useViewShot={viewShotEnabled}
            onCounter={recordCounter}
          />
        </Freeze>
      ))}
    </RNView>
  );

  const browserContent = (
    <RNView style={styles.fullLayer}>
      <RNView
        pointerEvents={showHomePage ? 'auto' : 'none'}
        style={[
          styles.fullLayer,
          showHomePage ? styles.activeLayer : styles.inactiveLayer,
        ]}
      >
        <DemoPlaceholderPage
          title="Discovery Home"
          description="This layer simulates minimizing the browser back to the Discovery dashboard."
        />
      </RNView>
      {homeFreezeEnabled ? (
        <Freeze freeze={showHomePage}>{webViewTabsLayer}</Freeze>
      ) : (
        <RNView
          pointerEvents={showHomePage ? 'none' : 'auto'}
          style={[
            styles.fullLayer,
            showHomePage ? styles.inactiveLayer : styles.activeLayer,
          ]}
        >
          {webViewTabsLayer}
        </RNView>
      )}
    </RNView>
  );

  return (
    <Page>
      <Page.Body px="$4" py={100} gap="$4">
        <YStack gap="$3">
          <XStack gap="$2">
            {WEBVIEW_FREEZE_DEMO_TABS.map((tab) => (
              <Button
                key={tab.id}
                flex={1}
                variant={tab.id === activeTabId ? 'primary' : 'secondary'}
                onPress={() => selectTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </XStack>

          <XStack gap="$2">
            {OUTER_PAGES.map((page) => (
              <Button
                key={page.id}
                flex={1}
                variant={
                  page.id === activeOuterPageId ? 'primary' : 'secondary'
                }
                onPress={() => setActiveOuterPageId(page.id)}
              >
                {page.label}
              </Button>
            ))}
          </XStack>

          <XStack gap="$2" flexWrap="wrap">
            <Button size="small" variant="tertiary" onPress={resetDemo}>
              Reset
            </Button>
            <Button size="small" variant="tertiary" onPress={mountAllTabs}>
              Mount all
            </Button>
            <Button
              size="small"
              variant={showHomePage ? 'primary' : 'secondary'}
              onPress={() => setShowHomePage((value) => !value)}
            >
              {showHomePage ? 'Show WebViews' : 'Show Home'}
            </Button>
            <Button
              size="small"
              variant={outerFreezeEnabled ? 'primary' : 'secondary'}
              onPress={() => setOuterFreezeEnabled((value) => !value)}
            >
              Outer Freeze
            </Button>
            <Button
              size="small"
              variant={homeFreezeEnabled ? 'primary' : 'secondary'}
              onPress={() => setHomeFreezeEnabled((value) => !value)}
            >
              Home Freeze
            </Button>
            <Button
              size="small"
              variant={innerFreezeEnabled ? 'primary' : 'secondary'}
              onPress={() => setInnerFreezeEnabled((value) => !value)}
            >
              Inner Freeze
            </Button>
            <Button
              size="small"
              variant={viewShotEnabled ? 'primary' : 'secondary'}
              onPress={() => setViewShotEnabled((value) => !value)}
            >
              ViewShot
            </Button>
          </XStack>

          <SizableText size="$bodySm" color="$textSubdued">
            {`Outer: ${activeOuterPageId} | active: ${
              activeTab?.label ?? '-'
            } | mounted: ${mountedTabIds.length}/3 | home: ${
              showHomePage ? 'on' : 'off'
            } | freeze O/H/I: ${outerFreezeEnabled ? '1' : '0'}/${
              homeFreezeEnabled ? '1' : '0'
            }/${innerFreezeEnabled ? '1' : '0'} | ViewShot: ${
              viewShotEnabled ? '1' : '0'
            }`}
          </SizableText>
        </YStack>

        <Stack
          flex={1}
          minHeight={360}
          borderWidth="$px"
          borderColor="$borderSubdued"
          borderRadius="$2"
          overflow="hidden"
        >
          <RNView style={styles.webViewHost}>
            {activeOuterPageId === 'market' ? (
              <DemoPlaceholderPage
                title="Market"
                description="Switching here can freeze the Browser page as an outer page."
              />
            ) : null}
            {activeOuterPageId === 'earn' ? (
              <DemoPlaceholderPage
                title="Earn"
                description="Switching here can freeze the Browser page as an outer page."
              />
            ) : null}
            <Freeze
              freeze={outerFreezeEnabled && activeOuterPageId !== 'browser'}
            >
              {browserContent}
            </Freeze>
          </RNView>
        </Stack>

        <YStack gap="$2">
          {WEBVIEW_FREEZE_DEMO_TABS.map((tab) => {
            const tabStats = stats[tab.id];
            return (
              <Stack
                key={tab.id}
                p="$3"
                borderWidth="$px"
                borderColor="$borderSubdued"
                borderRadius="$2"
                gap="$1"
              >
                <SizableText size="$bodyMdMedium">{tab.label}</SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {`mount ${tabStats.mounts} / unmount ${
                    tabStats.unmounts
                  } / loadStart ${tabStats.loadStarts} / loadEnd ${
                    tabStats.loadEnds
                  } / last ${
                    tabStats.lastEventName
                      ? `${tabStats.lastEventName}@${tabStats.lastEventAt}`
                      : '-'
                  }`}
                </SizableText>
              </Stack>
            );
          })}
        </YStack>
      </Page.Body>
    </Page>
  );
}
