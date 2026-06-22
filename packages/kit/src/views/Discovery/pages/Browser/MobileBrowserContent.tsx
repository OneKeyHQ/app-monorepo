import { useCallback, useMemo, useState } from 'react';

import { Freeze } from 'react-freeze';
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

function MobileBrowserContent({
  id,
  onScroll,
}: {
  id: string;
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
    // Evicted (cold) tab: render nothing. Inactive tabs are off-screen, and the
    // tab switcher uses the persisted thumbnail (tab.thumbnail), not this view.
    if (!keepAlive) {
      return null;
    }
    return (
      <>
        <Freeze key={tab.id} freeze={!isActive}>
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
                isCurrent={isActive}
                setBackEnabled={setBackEnabled}
                setForwardEnabled={setForwardEnabled}
                onScroll={onScroll}
                customReceiveHandler={customReceiveHandler}
              />
            </Stack>
          </ViewShot>
        </Freeze>
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab?.id,
    tab?.url,
    tab?.siteMode,
    isActive,
    keepAlive,
    customReceiveHandler,
  ]);
  return <>{content}</>;
}

export default MobileBrowserContent;
