import type { Context } from 'react';

import { Context as NativeCollapsibleTabContext } from 'react-native-collapsible-tab-view/src/Context';

import type { ITabContextType } from './context';

// Native: re-export Context from react-native-collapsible-tab-view,
// cast to shared ITabContextType for consistent typing across platforms.
export const CollapsibleTabContext =
  NativeCollapsibleTabContext as unknown as Context<
    ITabContextType<string> | undefined
  >;
