import { createContext } from 'react';

export interface IHomeStickyHeaderContext {
  portalTarget: HTMLElement | null;
  stickyHost: HTMLElement | null;
  activeTabName: string;
}

export const HomeStickyHeaderContext =
  createContext<IHomeStickyHeaderContext | null>(null);
