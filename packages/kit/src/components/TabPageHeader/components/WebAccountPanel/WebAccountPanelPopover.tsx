import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AnimatePresence,
  Popover,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import {
  DOWNLOAD_MOBILE_APP_URL,
  HELP_CENTER_URL,
} from '@onekeyhq/shared/src/config/appConfig';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { WebAccountPanelFooter } from './atoms/WebAccountPanelFooter';
import { WebAccountPanelHeader } from './atoms/WebAccountPanelHeader';
import { WebAccountPanelMain } from './WebAccountPanelMain';

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

const FORWARD_ENTER = { x: 24, opacity: 0 } as const;
const FORWARD_EXIT = { x: -24, opacity: 0 } as const;
const BACKWARD_ENTER = { x: -24, opacity: 0 } as const;
const BACKWARD_EXIT = { x: 24, opacity: 0 } as const;

const ANIMATE_ONLY_HEIGHT: string[] = ['height'];

const FLOATING_PANEL_PROPS = {
  width: 352,
  maxWidth: 352,
  p: 0,
  overflow: 'hidden',
  style: { transformOrigin: 'top right' },
} as const;

// TODO(i18n): once `global.back` is created on Lokalise, replace this with
// intl.formatMessage({ id: ETranslations.global_back }).
const backLabel = 'Back';

function ComingSoonView({
  title,
  onBack,
  showFooter,
  connected,
  onDownloadApp,
  onHelp,
  onSettings,
  onArticles,
}: {
  title: string;
  onBack: () => void;
  showFooter: boolean;
  connected: boolean;
  onDownloadApp?: () => void;
  onHelp?: () => void;
  onSettings?: () => void;
  onArticles?: () => void;
}) {
  return (
    <YStack w="100%">
      <WebAccountPanelHeader title={title} onBack={onBack} />
      <YStack px="$5" py="$10" ai="center">
        <SizableText size="$bodyMd" color="$textSubdued">
          Coming soon
        </SizableText>
      </YStack>
      {showFooter ? (
        <WebAccountPanelFooter
          connected={connected}
          onDownloadApp={onDownloadApp}
          onArticles={onArticles}
          onHelp={onHelp}
          onSettings={onSettings}
        />
      ) : null}
    </YStack>
  );
}

function PanelContent({
  initialView,
  connected,
  closePopover,
}: {
  initialView: IWebAccountPanelView;
  connected: boolean;
  closePopover: () => void;
}) {
  const [view, setView] = useState<IWebAccountPanelView>(initialView);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    setView(initialView);
    setDirection('forward');
  }, [initialView]);

  const navigate = useCallback((next: IWebAccountPanelView) => {
    setDirection('forward');
    setView(next);
  }, []);

  const back = useCallback(() => {
    setDirection('backward');
    setView('main');
  }, []);

  const handleDownloadApp = useCallback(() => {
    openUrlExternal(DOWNLOAD_MOBILE_APP_URL);
  }, []);

  const handleHelp = useCallback(() => {
    openUrlExternal(HELP_CENTER_URL);
  }, []);

  const enterStyle = direction === 'forward' ? FORWARD_ENTER : BACKWARD_ENTER;
  const exitStyle = direction === 'forward' ? FORWARD_EXIT : BACKWARD_EXIT;

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
        <ComingSoonView
          title={backLabel}
          onBack={back}
          showFooter={false}
          connected={connected}
        />
      );
    }
    if (view === 'settings') {
      return (
        <ComingSoonView
          title={backLabel}
          onBack={back}
          showFooter
          connected={connected}
          onDownloadApp={handleDownloadApp}
          onHelp={handleHelp}
          onArticles={() => navigate('articles')}
          onSettings={() => navigate('settings')}
        />
      );
    }
    return (
      <ComingSoonView
        title={backLabel}
        onBack={back}
        showFooter={false}
        connected={connected}
      />
    );
  }, [
    view,
    navigate,
    back,
    handleDownloadApp,
    handleHelp,
    closePopover,
    connected,
  ]);

  return (
    <Stack animation="quick" animateOnly={ANIMATE_ONLY_HEIGHT}>
      <AnimatePresence custom={direction} exitBeforeEnter>
        <Stack
          key={view}
          w="100%"
          animation="quick"
          enterStyle={enterStyle}
          exitStyle={exitStyle}
        >
          {rendered}
        </Stack>
      </AnimatePresence>
    </Stack>
  );
}

export function WebAccountPanelPopover({
  renderTrigger,
  initialView = 'main',
  connected = true,
}: IWebAccountPanelPopoverProps) {
  return (
    <Popover
      title=""
      showHeader={false}
      placement="bottom-end"
      offset={6}
      floatingPanelProps={FLOATING_PANEL_PROPS}
      renderTrigger={renderTrigger}
      renderContent={({ closePopover }) => (
        <PanelContent
          initialView={initialView}
          connected={connected}
          closePopover={closePopover}
        />
      )}
    />
  );
}
