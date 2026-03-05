import { createContext } from 'react';

// Portal target for desktop sticky column headers.
// DesktopLayout provides the HTMLElement via renderTabBar,
// and list components use createPortal to render their headers into it.
export const DesktopStickyHeaderContext = createContext<HTMLElement | null>(
  null,
);
