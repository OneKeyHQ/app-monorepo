import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { styled } from '@tamagui/core';
import { useIntl } from 'react-intl';

import { AnimatePresence, Popover, Stack, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
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

export interface IWebAccountPanelPopoverProps {
  renderTrigger: ReactNode;
  initialView?: IWebAccountPanelView;
  connected?: boolean;
}

const PANEL_WIDTH = 352;

const ANIMATE_ONLY_HEIGHT: string[] = ['height'];

const FLOATING_PANEL_PROPS = {
  width: PANEL_WIDTH,
  maxWidth: PANEL_WIDTH,
  p: 0,
  overflow: 'hidden',
  style: { transformOrigin: 'top right' },
} as const;

// One styled view per panel sub-view. The numeric `going` variant drives a
// full-width horizontal slide; AnimatePresence merges `custom` back onto the
// exiting element, so the exit direction is re-read at exit time (back
// navigation slides the opposite way). At exactly PANEL_WIDTH the entering and
// exiting views move as a seamless adjacent pair — a conveyor — so no
// cross-fade or opaque background is required.
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

function PanelContent({
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
  // +1 = forward (the new view enters from the right), -1 = backward.
  const [going, setGoing] = useState(1);
  // Monotonic key, bumped per navigation. Used as the AnimatePresence child key
  // (instead of `view`) so every switch is a fresh mount — even a rapid
  // switch-away-and-back. With `view` as the key, AnimatePresence revives the
  // still-exiting same-keyed element without remounting it, so its onLayout
  // never re-fires and the measured height gets stuck on the previous view.
  const [navSeq, setNavSeq] = useState(0);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  );
  const [heightReady, setHeightReady] = useState(false);

  // Only the active view should drive the container height; the exiting view
  // carries an older navSeq and is ignored.
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
    // Return to the entry view, not always 'main': the disconnected settings-
    // first entry can reach 'articles', and 'main' assumes a connected account.
    setView(initialView);
  }, [initialView]);

  const handleViewLayout = useCallback((seq: number, height: number) => {
    if (height > 0 && navSeqRef.current === seq) {
      setContentHeight(height);
    }
  }, []);

  // Apply the first measured height instantly (no grow-from-zero when the
  // popover opens); only animate the height for subsequent view changes.
  useEffect(() => {
    if (contentHeight !== undefined && !heightReady) {
      setHeightReady(true);
    }
  }, [contentHeight, heightReady]);

  const handleDownloadApp = useCallback(() => {
    openUrlExternal(DOWNLOAD_MOBILE_APP_URL);
  }, []);

  const handleHelp = useCallback(() => {
    // Close the panel first, then open the in-app Intercom messenger widget
    // (same entry the rest of the app uses) so the popover doesn't linger
    // behind it.
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

  // Stable reference so AnimatePresence's presence context doesn't churn on
  // height-settle re-renders (contentHeight/heightReady) when `going` is unchanged.
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

export function WebAccountPanelPopover({
  renderTrigger,
  initialView = 'main',
  connected = true,
}: IWebAccountPanelPopoverProps) {
  const { config } = useAccountSelectorContextData();
  return (
    <Popover
      title=""
      showHeader={false}
      placement="bottom-end"
      offset={6}
      floatingPanelProps={FLOATING_PANEL_PROPS}
      renderTrigger={renderTrigger}
      renderContent={({ closePopover }) =>
        config ? (
          <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
            <PanelContent
              initialView={initialView}
              connected={connected}
              closePopover={closePopover}
            />
          </AccountSelectorProviderMirror>
        ) : null
      }
    />
  );
}
