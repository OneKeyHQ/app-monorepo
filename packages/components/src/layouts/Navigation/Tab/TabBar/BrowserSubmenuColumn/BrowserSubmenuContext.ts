import { createContext, useContext } from 'react';

export interface IBrowserSubmenuContextValue {
  reportPopoverOpen: (isOpen: boolean) => void;
}

export const BrowserSubmenuContext = createContext<IBrowserSubmenuContextValue>(
  {
    reportPopoverOpen: () => {},
  },
);

export const useBrowserSubmenu = () => useContext(BrowserSubmenuContext);

/**
 * Whether tab rows may turn their icon into a close button. False right after
 * the column expands, until it has settled and the pointer has clearly moved,
 * so a click aimed at a favicon in the collapsed column (to switch tabs) does
 * not land on a close button that just appeared. Kept separate from
 * BrowserSubmenuContext so flips only re-render the rows that read it.
 */
export const BrowserSubmenuCloseArmedContext = createContext(true);

export const useBrowserSubmenuCloseArmed = () =>
  useContext(BrowserSubmenuCloseArmedContext);
