import { createContext } from 'react';

import type {
  ContextType,
  TabName,
} from 'react-native-collapsible-tab-view/src/types';

// Web: standalone context with the same type as native.
// On native the collapsible-tab-view Container provides the value;
// on web this defaults to undefined (NativeBannerScroller is native-only).
export const CollapsibleTabContext = createContext<
  ContextType<TabName> | undefined
>(undefined);

export type { ContextType as ICollapsibleTabContextType } from 'react-native-collapsible-tab-view/src/types';
