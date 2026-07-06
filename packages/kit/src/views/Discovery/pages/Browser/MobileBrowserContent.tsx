import { useCallback, useEffect, useMemo, useState } from 'react';

import ViewShot from 'react-native-view-shot';

import { Stack } from '@onekeyhq/components';
import type { IWebViewOnScrollEvent } from '@onekeyhq/kit/src/components/WebView/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { KeepAliveFreeze } from '../../components/KeepAliveFreeze';
import WebContent from '../../components/WebContent/WebContent';
import { useDiscoveryMessageHandler } from '../../hooks/useDiscoveryMessageHandler';
import {
  useActiveTabId,
  useDisplayHomePageFlag,
  useShouldKeepWebViewAlive,
  useWebTabDataById,
} from '../../hooks/useWebTabs';
import { captureViewRefs } from '../../utils/explorerUtils';

function MobileBrowserContent({
  id,
  onScroll,
}: {
  id: string;
  onScroll?: (event: IWebViewOnScrollEvent) => void;
}) {
  const { tab } = useWebTabDataById(id);
  const { activeTabId } = useActiveTabId();
  const { displayHomePage } = useDisplayHomePageFlag();
  const [, setBackEnabled] = useState(false);
  const [, setForwardEnabled] = useState(false);

  const isActive = useMemo(
    () => activeTabId === tab?.id,
    [tab?.id, activeTabId],
  );

  // Keep-alive LRU: tabs outside the window unmount their WebView to free
  // memory. The active tab is always alive, so it stays mounted here.
  const keepAlive = useShouldKeepWebViewAlive(tab?.id);

  // "Current" means the user is actually looking at this tab's WebView: the
  // active tab AND not collapsed to the Discovery home. Gate isCurrent on this
  // (not just isActive) so a minimized-but-still-mounted WebView doesn't keep
  // consuming the Android hardware Back handler while the home page is showing.
  const isCurrent = isActive && !displayHomePage;

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
    if (!tab || !tab?.id) {
      return null;
    }
    // Evicted (cold) or never-shown tab: render nothing. Inactive tabs are
    // hidden, and the tab switcher uses the persisted thumbnail
    // (tab.thumbnail), not this view.
    if (!keepAlive || !shouldMountWebView) {
      return null;
    }
    return (
      // Keep every alive tab mounted AND attached; hide inactive ones without
      // detaching their native view, so the WKWebView never reloads on tab
      // switch (see KeepAliveFreeze).
      <KeepAliveFreeze key={tab.id} freeze={!isActive}>
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
              url={tab.url}
              siteMode={tab.siteMode}
              isCurrent={isCurrent}
              setBackEnabled={setBackEnabled}
              setForwardEnabled={setForwardEnabled}
              onScroll={onScroll}
              customReceiveHandler={customReceiveHandler}
            />
          </Stack>
        </ViewShot>
      </KeepAliveFreeze>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab?.id,
    tab?.url,
    tab?.siteMode,
    isActive,
    isCurrent,
    keepAlive,
    shouldMountWebView,
    customReceiveHandler,
  ]);
  return <>{content}</>;
}

export default MobileBrowserContent;
