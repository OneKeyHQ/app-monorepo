import { createContext, useContext } from 'react';

export interface IBrowserSubmenuContextValue {
  reportPopoverOpen: (isOpen: boolean) => void;
  /**
   * False right after the column expands, until it has settled and the
   * pointer has clearly moved, so a click aimed at a favicon in the collapsed
   * column (to switch tabs) never lands on a close button that just appeared.
   */
  isCloseArmed: boolean;
}

export const BrowserSubmenuContext = createContext<IBrowserSubmenuContextValue>(
  {
    reportPopoverOpen: () => {},
    isCloseArmed: true,
  },
);

export const useBrowserSubmenu = () => useContext(BrowserSubmenuContext);
