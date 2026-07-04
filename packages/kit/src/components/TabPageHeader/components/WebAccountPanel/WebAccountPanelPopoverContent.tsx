import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { styled } from '@tamagui/core';
import { useIntl } from 'react-intl';

import { AnimatePresence, Stack, YStack } from '@onekeyhq/components';
import { DOWNLOAD_MOBILE_APP_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { WebAccountPanelFooter } from './atoms/WebAccountPanelFooter';
import { WebAccountPanelHeader } from './atoms/WebAccountPanelHeader';
import { WebAccountPanelAccountList } from './WebAccountPanelAccountList';
import { WebAccountPanelArticles } from './WebAccountPanelArticles';
import { WebAccountPanelMain } from './WebAccountPanelMain';
import { WebAccountPanelSettings } from './WebAccountPanelSettings';

import type { LayoutChangeEvent } from 'react-native';

export type IWebAccountPanelView =
  | 'main'
  | 'accountList'
  | 'settings'
  | 'articles';

const PANEL_WIDTH = 352;

const ANIMATE_ONLY_HEIGHT: string[] = ['height'];

const AnimatedPanelView = styled(Stack, {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  variants: {
    going: {
      ':number': (going: number) => ({
        enterStyle: { x: going >= 0 ? PANEL_WIDTH : -PANEL_WIDTH },
        exitStyle: { x: going >= 0 ? -PANEL_WIDTH : PANEL_WIDTH },
      }),
    },
  } as const,
});

export default function WebAccountPanelPopoverContent({
  initialView,
  connected,
  closePopover,
}: {
  initialView: IWebAccountPanelView;
  connected: boolean;
  closePopover: () => void;
}) {
  const intl = useIntl();
  const backLabel = intl.formatMessage({ id: ETranslations.global_back });
  const [view, setView] = useState<IWebAccountPanelView>(initialView);
  const [going, setGoing] = useState(1);
  const [navSeq, setNavSeq] = useState(0);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  );
  const [heightReady, setHeightReady] = useState(false);
  const navSeqRef = useRef(navSeq);
  navSeqRef.current = navSeq;

  useEffect(() => {
    setView(initialView);
    setGoing(1);
  }, [initialView]);

  const navigate = useCallback((next: IWebAccountPanelView) => {
    setGoing(1);
    setNavSeq((s) => s + 1);
    setView(next);
  }, []);

  const back = useCallback(() => {
    setGoing(-1);
    setNavSeq((s) => s + 1);
    setView(initialView);
  }, [initialView]);

  const handleViewLayout = useCallback((seq: number, height: number) => {
    if (height > 0 && navSeqRef.current === seq) {
      setContentHeight(height);
    }
  }, []);

  useEffect(() => {
    if (contentHeight !== undefined && !heightReady) {
      setHeightReady(true);
    }
  }, [contentHeight, heightReady]);

  const handleDownloadApp = useCallback(() => {
    openUrlExternal(DOWNLOAD_MOBILE_APP_URL);
  }, []);

  const handleHelp = useCallback(() => {
    closePopover();
    void showIntercom();
  }, [closePopover]);

  const rendered = useMemo(() => {
    if (view === 'main') {
      return (
        <WebAccountPanelMain
          onNavigateAccountList={() => navigate('accountList')}
          onNavigateSettings={() => navigate('settings')}
          onNavigateArticles={() => navigate('articles')}
          onHelp={handleHelp}
          onDownloadApp={handleDownloadApp}
          onRequestClose={closePopover}
        />
      );
    }
    if (view === 'accountList') {
      return (
        <YStack w="100%">
          <WebAccountPanelHeader title={backLabel} onBack={back} />
          <WebAccountPanelAccountList onRequestClose={closePopover} />
        </YStack>
      );
    }
    if (view === 'settings') {
      const isInitialEntry = initialView === 'settings';
      return (
        <YStack w="100%">
          {isInitialEntry ? null : (
            <WebAccountPanelHeader title={backLabel} onBack={back} />
          )}
          <WebAccountPanelSettings onRequestClose={closePopover} />
          {isInitialEntry ? (
            <WebAccountPanelFooter
              connected={connected}
              onDownloadApp={handleDownloadApp}
              onHelp={handleHelp}
              onArticles={() => navigate('articles')}
            />
          ) : null}
        </YStack>
      );
    }
    return (
      <YStack w="100%">
        <WebAccountPanelHeader title={backLabel} onBack={back} />
        <WebAccountPanelArticles onRequestClose={closePopover} />
      </YStack>
    );
  }, [
    view,
    initialView,
    navigate,
    back,
    handleDownloadApp,
    handleHelp,
    closePopover,
    connected,
    backLabel,
  ]);

  const presenceCustom = useMemo(() => ({ going }), [going]);

  return (
    <Stack
      position="relative"
      width="100%"
      overflow="hidden"
      height={contentHeight}
      animation={heightReady ? 'smooth' : '0ms'}
      animateOnly={ANIMATE_ONLY_HEIGHT}
    >
      <AnimatePresence custom={presenceCustom} initial={false}>
        <AnimatedPanelView
          key={navSeq}
          going={going}
          animation="smooth"
          onLayout={(e: LayoutChangeEvent) =>
            handleViewLayout(navSeq, e.nativeEvent.layout.height)
          }
        >
          {rendered}
        </AnimatedPanelView>
      </AnimatePresence>
    </Stack>
  );
}
