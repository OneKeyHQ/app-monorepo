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
import { useBrowserHistoryAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebContent from '../../components/WebContent/WebContent';
import { useWebTabDataById } from '../../hooks/useWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';

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
                onPress={handleFindPrev}
              />
              <IconButton
                disabled={disabled}
                variant="tertiary"
                icon="ChevronDownSmallOutline"
                size="small"
                onPress={handleFindNext}
              />
              <IconButton
                variant="tertiary"
                icon="CrossedSmallSolid"
                size="small"
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

function DesktopBrowserContent({
  id,
  activeTabId,
}: {
  id: string;
  activeTabId: string | null;
}) {
  const { tab } = useWebTabDataById(id);
  const isActive = activeTabId === id;
  const { addBrowserHistory } = useBrowserHistoryAction().current;
  return (
    <Freeze key={id} freeze={!isActive}>
      {platformEnv.isDesktop ? <Find id={id} /> : null}
      <WebContent
        id={id}
        url={tab.url}
        isCurrent={isActive}
        addBrowserHistory={(siteInfo) => addBrowserHistory(siteInfo)}
      />
    </Freeze>
  );
}

export default DesktopBrowserContent;
