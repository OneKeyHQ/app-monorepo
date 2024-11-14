import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { Freeze } from 'react-freeze';

import {
  IconButton,
  Input,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { useBrowserHistoryAction } from '@onekeyhq/kit/src/states/jotai/contexts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import WebContent from '../../components/WebContent/WebContent';
import { useWebTabDataById } from '../../hooks/useWebTabs';
import { webviewRefs } from '../../utils/explorerUtils';
import { useDebouncedCallback } from 'use-debounce';

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
}

function BasicFind({ id }: { id: string }) {
  const [matches, setMatches] = useState(0)
  const [activeMatchOrdinal, setActiveMatchOrdinal] = useState(0)
  const prevSearchText = useRef('');
  const handleFindPrev = useCallback(() => {
    const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
    webView.findInPage(prevSearchText.current, {
      findNext: false,
      forward: false,
    });  }, []);
  const handleFindNext = useCallback(() => {
    const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
    if (activeMatchOrdinal === matches) {

    } else {
      webView.findInPage(prevSearchText.current, {
        findNext: false,
        forward: true,
      });
    }
  }, [id, activeMatchOrdinal, matches]);

  const handleClose = useCallback(() => {
  }, []);

  const bindEvent = useCallback(() => {
    const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
    webView.addEventListener('found-in-page', ({ result }: { result: {
        requestId: number,
        matches: number,
        selectionArea: {
            x: number,
            y: number,
            width: number,
            height: number
        },
        activeMatchOrdinal: number,
        finalUpdate: boolean
    }}) => {
      console.log(result);
      // webView.stopFindInPage('activateSelection');
      setMatches(result.matches)
      setActiveMatchOrdinal(result.activeMatchOrdinal)
    });
    console.log('event init!!')
  }, [id]);

  const repeatBindEvent = useCallback(() => {
    const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
    if (webView) {
      bindEvent();
    } else {
      setTimeout(() => {
        repeatBindEvent();
      }, 3000);
    }
  }, [bindEvent, id]);

  useEffect(() => {
    repeatBindEvent();
  }, [bindEvent, id, repeatBindEvent]);

  const handleTextChange = useDebouncedCallback(
    (text: string) => {
      const webView = webviewRefs[id]?.innerRef as unknown as IElectronWebView;
      if (!webView) {
        return;
      }
      if (text.length === 0) {
        webView.stopFindInPage('clearSelection');
      } else {
        webView.findInPage(text, { findNext: true, forward: false });
      }
      prevSearchText.current = text;
    },
    100,
  );

  return (
    <XStack position="absolute" left="50%" top={0} zIndex={100_000}>
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
          onChangeText={handleTextChange}
          containerProps={{
            borderWidth: 0,
            px: 0,
          }}
          InputComponentStyle={{
            px: 0,
          }}
        />
        <SizableText>{activeMatchOrdinal}/{matches}</SizableText>
        <Stack width="$px" height="100%" bg="$borderStrong" />
        <XStack gap="$2">
          <IconButton
            variant="tertiary"
            icon="ChevronTopSmallOutline"
            size="small"
            onPress={handleFindPrev}
          />
          <IconButton
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
