import { createContext } from 'react';

import type { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

export interface IHomeStickyHeaderContext {
  portalTarget: HTMLElement | null;
  tabBarRightPortalTarget: HTMLElement | null;
  stickyHost: HTMLElement | null;
  activeTabName: string;
  activeTabId: EHomeWalletTab | undefined;
}

export const HomeStickyHeaderContext =
  createContext<IHomeStickyHeaderContext | null>(null);
