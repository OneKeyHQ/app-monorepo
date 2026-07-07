import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { Stack } from '@onekeyhq/components';
import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebContent from '../../components/WebContent/WebContent';
import { useDiscoveryMessageHandler } from '../../hooks/useDiscoveryMessageHandler';
import {
  useActiveTabId,
  useShouldKeepWebViewAlive,
  useWebTabDataById,
} from '../../hooks/useWebTabs';
import { captureViewRefs } from '../../utils/explorerUtils';

const styles = StyleSheet.create({
  webPageLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});

function MobileBrowserContent({
  id,
  isBrowserContentVisible,
  onScroll,
}: {
  id: string;
  isBrowserContentVisible: boolean;
  onScroll?: (event: IWebViewOnScrollEvent) => void;
}) {
  const { tab } = useWebTabDataById(id);
  const { activeTabId } = useActiveTabId();
  const [, setBackEnabled] = useState(false);
  const [, setForwardEnabled] = useState(false);

  const isActive = useMemo(
    () => activeTabId === tab?.id,
    [tab?.id, activeTabId],
  );

  // Keep-alive LRU: tabs outside the window unmount their WebView to free
  // memory. The active tab is always alive, so it stays mounted here.
  const keepAlive = useShouldKeepWebViewAlive(tab?.id);

  // "Current" means the user is actually looking at this tab's WebView. Gate
  // isCurrent on this (not just isActive) so a hidden-but-still-mounted WebView
  // can pause foreground-only work while Discovery home / Market / Earn shows.
  const isCurrent = isActive && isBrowserContentVisible;

  // The tab URL is live navigation state. Keep the WebView source stable after
  // first mount; explicit navigations use crossWebviewLoadUrl/loadUrl instead.
  const webViewInitialUrlRef = useRef<string | undefined>(undefined);
  if (!webViewInitialUrlRef.current && tab?.url) {
    webViewInitialUrlRef.current = tab.url;
  }
  const webViewInitialUrl = webViewInitialUrlRef.current;

  // Lazy first mount: restored tabs enter the keep-alive window on cold start
  // without ever being opened. Mount a tab's WebView only after it has been
  // shown once this session, so opening Discovery doesn't load every restored
  // tab in the background. Once shown, it stays mounted while alive; when the
  // tab is evicted from the alive window we re-arm the gate so re-admitting it
  // (e.g. after another tab closes) doesn't silently remount + load it in the
  // background — it stays cold until the user activates it again. The active
  // tab is always alive, so this can never unmount the visible tab.
  const [hasBeenShown, setHasBeenShown] = useState(false);
  useEffect(() => {
    if (isCurrent) {
      setHasBeenShown(true);
    } else if (!keepAlive) {
      setHasBeenShown(false);
    }
  }, [isCurrent, keepAlive]);

  // Derive the mount decision synchronously so the very first activation mounts
  // the WebView in the same commit (isCurrent flips true) instead of rendering
  // one blank frame while waiting for the hasBeenShown effect to run.
  const shouldMountWebView = hasBeenShown || isCurrent;

  const { customReceiveHandler } = useDiscoveryMessageHandler();

  const initCaptureViewRef = useCallback(
    ($ref: any) => {
      if ($ref) {
        captureViewRefs[id] = $ref;
      } else {
        delete captureViewRefs[id];
      }
    },
    [id],
  );

  const content = useMemo(() => {
    if (!tab?.id || !webViewInitialUrl) {
      return null;
    }
    // Evicted (cold) or never-shown tab: render nothing. Inactive tabs are
    // hidden, and the tab switcher uses the persisted thumbnail
    // (tab.thumbnail), not this view.
    if (!keepAlive || !shouldMountWebView) {
      return null;
    }
    return (
      <View
        key={tab.id}
        collapsable={false}
        pointerEvents={isActive ? 'auto' : 'none'}
        accessibilityElementsHidden={!isActive}
        importantForAccessibility={isActive ? 'auto' : 'no-hide-descendants'}
        style={[styles.webPageLayer, { display: isActive ? 'flex' : 'none' }]}
      >
        <ViewShot ref={initCaptureViewRef} style={{ flex: 1 }}>
          <Stack
            flex={1}
            mt="$3"
            // https://github.com/gre/react-native-view-shot/issues/7
            collapsable={platformEnv.isNativeAndroid ? false : undefined}
            bg={platformEnv.isNativeAndroid ? '$bgApp' : undefined}
          >
            <WebContent
              id={tab.id}
              url={webViewInitialUrl}
              siteMode={tab.siteMode}
              isCurrent={isCurrent}
              setBackEnabled={setBackEnabled}
              setForwardEnabled={setForwardEnabled}
              onScroll={onScroll}
              customReceiveHandler={customReceiveHandler}
            />
          </Stack>
        </ViewShot>
      </View>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab?.id,
    tab?.siteMode,
    webViewInitialUrl,
    isActive,
    isCurrent,
    keepAlive,
    shouldMountWebView,
    customReceiveHandler,
  ]);
  return <>{content}</>;
}

export default MobileBrowserContent;
