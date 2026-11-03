import { createContext, useContext } from 'react';

import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IMarketDetailWatchlistSidebarMode = 'docked' | 'overlay';

export interface IMarketDetailWatchlistSidebarContextValue {
  // False until the frame has measured its width and picked a mode.
  isReady: boolean;
  mode: IMarketDetailWatchlistSidebarMode;
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

export const MarketDetailWatchlistSidebarContext =
  createContext<IMarketDetailWatchlistSidebarContextValue | null>(null);

export function useMarketDetailWatchlistSidebar() {
  return useContext(MarketDetailWatchlistSidebarContext);
}

function SidebarToggleButton({
  sidebar,
}: {
  sidebar: IMarketDetailWatchlistSidebarContextValue;
}) {
  const intl = useIntl();
  return (
    <IconButton
      testID="market-detail-watchlist-sidebar-toggle"
      // Figma 27445:36352: the `star-list` glyph left of the token, at the
      // medium size (24px glyph, 36px hit area).
      icon="StarListOutline"
      variant="tertiary"
      size="medium"
      title={intl.formatMessage({ id: ETranslations.market_open_favorites })}
      onPress={sidebar.toggle}
    />
  );
}

// Renders only under the desktop detail layout, which provides the context;
// the shared headers also render on mobile, where it stays out. It only opens
// the sidebar: a docked, open sidebar closes from its own X, so the header
// button steps aside rather than sit beside a second close control.
export function MarketDetailWatchlistSidebarToggle() {
  const sidebar = useMarketDetailWatchlistSidebar();
  if (
    !sidebar ||
    !sidebar.isReady ||
    (sidebar.mode === 'docked' && sidebar.isOpen)
  ) {
    return null;
  }
  return <SidebarToggleButton sidebar={sidebar} />;
}
