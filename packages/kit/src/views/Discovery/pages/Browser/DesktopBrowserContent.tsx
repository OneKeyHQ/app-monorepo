/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { ReactNode } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { Freeze } from 'react-freeze';
import { useThrottledCallback } from 'use-debounce';

import {
  AnimatePresence,
  IconButton,
  Input,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebContent from '../../components/WebContent/WebContent';
import { useDiscoveryMessageHandler } from '../../hooks/useDiscoveryMessageHandler';
import {
  useShouldKeepWebViewAlive,
  useWebTabDataById,
} from '../../hooks/useWebTabs';
import { releaseDesktopWebviewResources } from '../../utils/desktopWebviewCleanup';
import { webviewRefs } from '../../utils/explorerUtils';
import DashboardContent from '../Dashboard/DashboardContent';

import type { TextInput } from 'react-native';

interface IElectronWebView {
  stopFindInPage: (text: string) => void;
  findInPage: (
    text: string,
    params?: { findNext: boolean; forward: boolean },
  ) => void;
  addEventListener: (
    eventName: string,
    callback: (result: any) => void,
  ) => void;
  removeEventListener: (
    eventName: string,
    callback: (result: any) => void,
  ) => void;
}

function findInWebView(
  webView: IElectronWebView | undefined,
  text: string,
  params: { findNext: boolean; forward: boolean },
) {
  try {
    webView?.findInPage(text, params);
  } catch {
    // The guest can be unavailable while its WebView is loading or remounting.
  }
}

function stopFindInWebView(webView: IElectronWebView | undefined) {
  try {
    webView?.stopFindInPage('clearSelection');
  } catch {
    // The guest may already have been destroyed.
  }
}

function BasicFind({ id, isActive }: { id: string; isActive: boolean }) {
  const [matches, setMatches] = useState(0);
  const [activeMatchOrdinal, setActiveMatchOrdinal] = useState(0);
  const [visible, setIsVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const prevSearchText = useRef('');
  const handleFindPrev = useCallback(() => {
    if (matches < 1) {
      return;
    }
    findInWebView(
      webviewRefs[id]?.innerRef as IElectronWebView | undefined,
      prevSearchText.current,
      {
        findNext: false,
        forward: false,
      },
    );
  }, [id, matches]);
  const handleFindNext = useCallback(() => {
    if (matches < 1) {
      return;
    }
    if (activeMatchOrdinal === matches) {
      findInWebView(
        webviewRefs[id]?.innerRef as IElectronWebView | undefined,
        prevSearchText.current,
        {
          findNext: true,
          forward: true,
        },
      );
    } else {
      findInWebView(
        webviewRefs[id]?.innerRef as IElectronWebView | undefined,
        prevSearchText.current,
        {
          findNext: false,
          forward: true,
        },
      );
    }
  }, [id, activeMatchOrdinal, matches]);

  const foundInPage = useCallback(
    ({
      result,
    }: {
      result: {
        requestId: number;
        matches: number;
        selectionArea: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
        activeMatchOrdinal: number;
        finalUpdate: boolean;
      };
    }) => {
      console.log(result);
      setMatches(result.matches);
      setActiveMatchOrdinal(result.activeMatchOrdinal);
    },
    [],
  );

  const handleTextChange = useThrottledCallback((text: string) => {
    if (text.length === 0) {
      stopFindInWebView(
        webviewRefs[id]?.innerRef as IElectronWebView | undefined,
      );
      setMatches(0);
      setActiveMatchOrdinal(0);
    } else {
      findInWebView(
        webviewRefs[id]?.innerRef as IElectronWebView | undefined,
        text,
        { findNext: true, forward: false },
      );
    }
  }, 250);

  const handleInputChange = useCallback(
    (text: string) => {
      prevSearchText.current = text;
      handleTextChange(text);
    },
    [handleTextChange],
  );

  const handleClose = useCallback(() => {
    handleTextChange.cancel();
    stopFindInWebView(
      webviewRefs[id]?.innerRef as IElectronWebView | undefined,
    );
    prevSearchText.current = '';
    setMatches(0);
    setActiveMatchOrdinal(0);
    setIsVisible(false);
  }, [handleTextChange, id]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const callback = ({ tabId }: { tabId: string }) => {
      if (id !== tabId) {
        return;
      }
      setIsVisible(true);
      inputRef.current?.focus();
    };
    appEventBus.on(EAppEventBusNames.ShowFindInWebPage, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowFindInWebPage, callback);
    };
  }, [id, isActive]);

  useEffect(() => {
    if (!visible || !isActive) {
      return undefined;
    }

    let webView: IElectronWebView | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const replaySearch = () => {
      if (prevSearchText.current) {
        findInWebView(webView, prevSearchText.current, {
          findNext: true,
          forward: false,
        });
      }
    };
    const attachFindListener = () => {
      const currentWebView = webviewRefs[id]?.innerRef as
        | IElectronWebView
        | undefined;
      if (!currentWebView) {
        retryTimer = setTimeout(attachFindListener, 100);
        return;
      }
      webView = currentWebView;
      currentWebView.addEventListener('found-in-page', foundInPage);
      currentWebView.addEventListener('dom-ready', replaySearch);
      replaySearch();
    };
    attachFindListener();

    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      handleTextChange.cancel();
      webView?.removeEventListener('dom-ready', replaySearch);
      webView?.removeEventListener('found-in-page', foundInPage);
      stopFindInWebView(
        (webviewRefs[id]?.innerRef as IElectronWebView | undefined) ?? webView,
      );
    };
  }, [foundInPage, handleTextChange, id, isActive, visible]);

  const disabled = matches === 0;

  return (
    <AnimatePresence>
      {visible ? (
        <XStack
          display={isActive ? 'flex' : 'none'}
          position="absolute"
          left="50%"
          top="$2.5"
          zIndex={100_000}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY_TRANSFORM}
          enterStyle={{
            opacity: 0,
            y: -20,
          }}
          exitStyle={{
            opacity: 0,
            y: -20,
          }}
        >
          <XStack
            bg="$bgApp"
            left="-50%"
            py="$2.5"
            px="$4"
            ai="center"
            borderRadius="$3"
            borderWidth="$px"
            borderColor="$border"
            gap="$4"
          >
            <Input
              testID="discovery-input"
              autoFocus
              ref={inputRef}
              onChangeText={handleInputChange}
              containerProps={{
                borderWidth: 0,
                px: 0,
              }}
              InputComponentStyle={{
                px: 0,
              }}
            />
            <SizableText
              minWidth="$16"
              textAlign="center"
              color={disabled ? '$textSubdued' : undefined}
            >
              {activeMatchOrdinal}/{matches}
            </SizableText>
            <Stack width="$px" height="100%" bg="$borderStrong" />
            <XStack gap="$2">
              <IconButton
                disabled={disabled}
                variant="tertiary"
                icon="ChevronTopSmallOutline"
                size="small"
                testID="browser-find-prev-button"
                onPress={handleFindPrev}
              />
              <IconButton
                disabled={disabled}
                variant="tertiary"
                icon="ChevronDownSmallOutline"
                size="small"
                testID="browser-find-next-button"
                onPress={handleFindNext}
              />
              <IconButton
                variant="tertiary"
                icon="CrossedSmallSolid"
                size="small"
                testID="browser-find-close-button"
                onPress={handleClose}
              />
            </XStack>
          </XStack>
        </XStack>
      ) : null}
    </AnimatePresence>
  );
}

const Find = memo(BasicFind);

const DESKTOP_HOME_PAGE_VISIBLE_DELAY_MS = 200;

function BasicDesktopBrowserContent({
  id,
  activeTabId,
}: {
  id: string;
  activeTabId: string | null;
}) {
  const { tab } = useWebTabDataById(id);
  const isActive = activeTabId === id;
  const isHomeTab = !tab?.url;
  const [homePageReady, setHomePageReady] = useState(!isHomeTab);

  // Keep-alive LRU: only the most-recently-active window of tabs keeps its
  // WebView mounted. Evicted (cold) tabs unmount their WebView to free memory;
  // the home/dashboard tab has no WebView and is unaffected.
  const keepAlive = useShouldKeepWebViewAlive(id);
  const shouldMountWebView = Boolean(tab?.url) && keepAlive;

  // Aggressively release the webview's resources when this tab closes OR when it
  // is evicted from the keep-alive window.
  useEffect(() => {
    if (!shouldMountWebView) {
      releaseDesktopWebviewResources(id);
    }
  }, [id, shouldMountWebView]);
  useEffect(() => () => releaseDesktopWebviewResources(id), [id]);

  useEffect(() => {
    if (!isHomeTab) {
      setHomePageReady(true);
      return undefined;
    }

    setHomePageReady(false);
    const timer = setTimeout(() => {
      setHomePageReady(true);
    }, DESKTOP_HOME_PAGE_VISIBLE_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isHomeTab]);

  const { customReceiveHandler } = useDiscoveryMessageHandler();

  let body: ReactNode = null;
  if (!tab?.url) {
    body = (
      <Stack flex={1} opacity={homePageReady ? 1 : 0}>
        <DashboardContent tabId={id} />
      </Stack>
    );
  } else if (shouldMountWebView) {
    body = (
      <WebContent
        id={id}
        url={tab.url}
        isCurrent={isActive}
        customReceiveHandler={customReceiveHandler}
      />
    );
  }
  // else: cold (evicted) tab renders nothing — it is off-screen behind the
  // active tab and remounts/reloads when activated again.

  return (
    <>
      {platformEnv.isDesktop ? <Find id={id} isActive={isActive} /> : null}
      <Freeze key={id} freeze={!isActive}>
        {body}
      </Freeze>
    </>
  );
}

const DesktopBrowserContent = memo(BasicDesktopBrowserContent);
export default DesktopBrowserContent;
