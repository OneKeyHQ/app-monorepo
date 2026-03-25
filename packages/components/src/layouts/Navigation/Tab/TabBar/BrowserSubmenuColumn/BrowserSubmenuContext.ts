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
