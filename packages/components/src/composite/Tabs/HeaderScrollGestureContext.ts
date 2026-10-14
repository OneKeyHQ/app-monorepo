import { createContext } from 'react';

import type { GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

// Nested native scroll views must take priority over the header's page pans.
export const HeaderScrollGestureContext = createContext<GestureType[]>([]);

// Children report touch eligibility before the header decides gesture ownership.
export const HeaderScrollGestureChildPanContext = createContext<
  SharedValue<boolean> | undefined
>(undefined);
