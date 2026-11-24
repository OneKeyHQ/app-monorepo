import { createContext, useContext } from 'react';

export type ISidebarAppearance = {
  showLabels: boolean;
  setShowLabels: (showLabels: boolean) => void;
};

// Provided only where labels can be turned off (desktop); absent means shown.
export const SidebarAppearanceContext = createContext<
  ISidebarAppearance | undefined
>(undefined);

export function useSidebarIconsOnly() {
  return useContext(SidebarAppearanceContext)?.showLabels === false;
}
