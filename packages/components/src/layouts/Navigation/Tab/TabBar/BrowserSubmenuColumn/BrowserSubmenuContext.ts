import { createContext, useContext } from 'react';

export interface IBrowserSubmenuContextValue {
  reportPopoverOpen: (isOpen: boolean) => void;
  /**
   * False right after the column expands until the pointer clearly moves.
   * Tab rows use it to avoid turning the icon under a stationary cursor into
   * a close button, so a click meant to switch tabs does not close one.
   */
  hasPointerMovedSinceExpand: boolean;
}

export const BrowserSubmenuContext = createContext<IBrowserSubmenuContextValue>(
  {
    reportPopoverOpen: () => {},
    hasPointerMovedSinceExpand: true,
  },
);

export const useBrowserSubmenu = () => useContext(BrowserSubmenuContext);
