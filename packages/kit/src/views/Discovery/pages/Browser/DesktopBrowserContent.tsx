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
import type {
  ICustomInjectionAutoReviewEvent,
  ICustomInjectionRecordingCommand,
  ICustomInjectionRecordingEvent,
  IElectronWebViewEvents,
} from '@onekeyhq/kit/src/components/WebView/types';
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

function BasicFind({ id }: { id: string }) {
  const [matches, setMatches] = useState(0);
  const [activeMatchOrdinal, setActiveMatchOrdinal] = useState(0);
  const [visible, setIsVisible] = useState(false);
  const prevSearchText = useRef('');
  const handleFindPrev = useCallback(() => {
    if (matches < 1) {
      return;
    }
    const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
    webView.findInPage(prevSearchText.current, {
      findNext: false,
      forward: false,
    });
  }, [id, matches]);
  const handleFindNext = useCallback(() => {
    if (matches < 1) {
      return;
    }
    const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
    if (activeMatchOrdinal === matches) {
      webView.findInPage(prevSearchText.current, {
        findNext: true,
        forward: false,
      });
    } else {
      webView.findInPage(prevSearchText.current, {
        findNext: false,
        forward: true,
      });
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

  const handleClose = useCallback(() => {
    setIsVisible(false);
    const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
    if (webView) {
      webView.removeEventListener('found-in-page', foundInPage);
    }
  }, [foundInPage, id]);

  useEffect(() => {
    const callback = ({ tabId }: { tabId: string }) => {
      if (id !== tabId) {
        return;
      }
      setIsVisible(true);
      const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
      if (webView) {
        webView.addEventListener('found-in-page', foundInPage);
      }
    };
    appEventBus.on(EAppEventBusNames.ShowFindInWebPage, callback);
    return () => {
      const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
      if (webView) {
        webView.removeEventListener('found-in-page', foundInPage);
      }
      appEventBus.off(EAppEventBusNames.ShowFindInWebPage, callback);
    };
  }, [foundInPage, id]);

  const handleTextChange = useThrottledCallback((text: string) => {
    const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
    if (!webView) {
      return;
    }
    if (text.length === 0) {
      webView.stopFindInPage('clearSelection');
      setMatches(0);
      setActiveMatchOrdinal(0);
    } else {
      webView.findInPage(text, { findNext: true, forward: false });
    }
    prevSearchText.current = text;
  }, 250);

  const disabled = matches === 0;

  return (
    <AnimatePresence>
      {visible ? (
        <XStack
          position="absolute"
          left="50%"
          top="$2.5"
          zIndex={100_000}
          animation="quick"
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
              onChangeText={handleTextChange}
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
  customInjectionUrl,
  customInjectionWebViewKey,
  customInjectionE2EPassKey,
  desktopPreloadUrl,
  onCustomInjectionAutoReview,
  partition,
  customInjectionRecordingCommand,
  onCustomInjectionRecordingEvent,
  onCustomInjectionDidStartNavigation,
  onCustomInjectionDidRedirectNavigation,
  onCustomInjectionNavigationSettled,
  onCustomInjectionDomReady,
}: {
  id: string;
  activeTabId: string | null;
  customInjectionUrl?: string;
  customInjectionWebViewKey?: string;
  desktopPreloadUrl?: string;
  onCustomInjectionAutoReview?: (
    event: ICustomInjectionAutoReviewEvent,
    instanceKey?: string,
    e2ePassKey?: string,
  ) => void;
  customInjectionE2EPassKey?: string;
  partition?: string;
  customInjectionRecordingCommand?: ICustomInjectionRecordingCommand;
  onCustomInjectionRecordingEvent?: (
    event: ICustomInjectionRecordingEvent,
  ) => void;
  onCustomInjectionDidStartNavigation?: (
    event: Parameters<
      NonNullable<IElectronWebViewEvents['onDidStartNavigation']>
    >[0],
    instanceKey?: string,
  ) => void;
  onCustomInjectionDidRedirectNavigation?: (
    event: Parameters<
      NonNullable<IElectronWebViewEvents['onDidRedirectNavigation']>
    >[0],
    instanceKey?: string,
  ) => void;
  onCustomInjectionNavigationSettled?: (
    loaded: boolean,
    instanceKey?: string,
  ) => void;
  onCustomInjectionDomReady?: (
    instanceKey?: string,
    e2ePassKey?: string,
  ) => void;
}) {
  const { tab } = useWebTabDataById(id);
  const isActive = activeTabId === id;
  const effectiveUrl = customInjectionUrl || tab?.url;
  const isHomeTab = !effectiveUrl;
  const [homePageReady, setHomePageReady] = useState(!isHomeTab);
  const webViewInstanceKey =
    customInjectionWebViewKey || desktopPreloadUrl || partition
      ? `custom-injected-${
          customInjectionWebViewKey || id
        }-${desktopPreloadUrl || 'default'}-${partition || 'persist:onekey'}`
      : id;
  const latestWebViewInstanceKeyRef = useRef(webViewInstanceKey);
  latestWebViewInstanceKeyRef.current = webViewInstanceKey;
  const isWebViewInstanceCurrent = useCallback(
    () => latestWebViewInstanceKeyRef.current === webViewInstanceKey,
    [webViewInstanceKey],
  );

  // Keep-alive LRU: only the most-recently-active window of tabs keeps its
  // WebView mounted. Evicted (cold) tabs unmount their WebView to free memory;
  // the home/dashboard tab has no WebView and is unaffected.
  const keepAlive = useShouldKeepWebViewAlive(id);
  const shouldMountWebView = Boolean(effectiveUrl) && keepAlive;

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
  const handleCustomInjectionAutoReview = useCallback(
    (event: ICustomInjectionAutoReviewEvent) =>
      onCustomInjectionAutoReview?.(
        event,
        customInjectionWebViewKey,
        customInjectionE2EPassKey,
      ),
    [
      customInjectionE2EPassKey,
      customInjectionWebViewKey,
      onCustomInjectionAutoReview,
    ],
  );
  const handleCustomInjectionDidStartNavigation = useCallback<
    NonNullable<IElectronWebViewEvents['onDidStartNavigation']>
  >(
    (event) =>
      onCustomInjectionDidStartNavigation?.(event, customInjectionWebViewKey),
    [customInjectionWebViewKey, onCustomInjectionDidStartNavigation],
  );
  const handleCustomInjectionDidRedirectNavigation = useCallback<
    NonNullable<IElectronWebViewEvents['onDidRedirectNavigation']>
  >(
    (event) =>
      onCustomInjectionDidRedirectNavigation?.(
        event,
        customInjectionWebViewKey,
      ),
    [customInjectionWebViewKey, onCustomInjectionDidRedirectNavigation],
  );
  const handleCustomInjectionNavigationSettled = useCallback(
    (loaded: boolean) =>
      onCustomInjectionNavigationSettled?.(loaded, customInjectionWebViewKey),
    [customInjectionWebViewKey, onCustomInjectionNavigationSettled],
  );
  const handleCustomInjectionDomReady = useCallback(() => {
    if (customInjectionE2EPassKey) {
      onCustomInjectionDomReady?.(
        customInjectionWebViewKey,
        customInjectionE2EPassKey,
      );
      return;
    }
    onCustomInjectionDomReady?.(customInjectionWebViewKey);
  }, [
    customInjectionE2EPassKey,
    customInjectionWebViewKey,
    onCustomInjectionDomReady,
  ]);

  let body: ReactNode = null;
  if (!effectiveUrl) {
    body = (
      <Stack flex={1} opacity={homePageReady ? 1 : 0}>
        <DashboardContent tabId={id} />
      </Stack>
    );
  } else if (shouldMountWebView) {
    body = (
      <WebContent
        key={webViewInstanceKey}
        id={id}
        url={effectiveUrl}
        isWebViewInstanceCurrent={isWebViewInstanceCurrent}
        partition={partition}
        desktopPreloadUrl={desktopPreloadUrl}
        onCustomInjectionAutoReview={handleCustomInjectionAutoReview}
        customInjectionRecordingCommand={customInjectionRecordingCommand}
        onCustomInjectionRecordingEvent={onCustomInjectionRecordingEvent}
        onCustomInjectionDidStartNavigation={
          handleCustomInjectionDidStartNavigation
        }
        onCustomInjectionDidRedirectNavigation={
          handleCustomInjectionDidRedirectNavigation
        }
        onCustomInjectionNavigationSettled={
          handleCustomInjectionNavigationSettled
        }
        onCustomInjectionDomReady={handleCustomInjectionDomReady}
        isCurrent={isActive}
        customReceiveHandler={customReceiveHandler}
      />
    );
  }
  // else: cold (evicted) tab renders nothing — it is off-screen behind the
  // active tab and remounts/reloads when activated again.

  return (
    <Freeze key={id} freeze={!isActive}>
      {platformEnv.isDesktop ? <Find id={id} /> : null}
      {body}
    </Freeze>
  );
}

const DesktopBrowserContent = memo(BasicDesktopBrowserContent);
export default DesktopBrowserContent;
