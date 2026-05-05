import { createContext } from 'react';

// Portal target for desktop sticky column headers.
// DesktopLayout provides the HTMLElement and the active tab name,
// ensuring only one tab's portal renders at a time (single source of truth).
export interface IDesktopStickyHeaderContext {
  portalTarget: HTMLElement | null;
  activeTabName: string;
}

export const DesktopStickyHeaderContext =
  createContext<IDesktopStickyHeaderContext | null>(null);
