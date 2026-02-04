import type { Context } from 'react';

import { TabsContext } from './context';

import type { ITabContextType } from './context';

// Web: re-export TabsContext which provides the same shape
// (focusedTab, refMap, scrollYCurrent, contentInset, etc.)
export const CollapsibleTabContext = TabsContext as unknown as Context<
  ITabContextType<string> | undefined
>;
