import { createContext } from 'react';

import type { GestureType } from 'react-native-gesture-handler';

// Nested native scroll views must take priority over the header's page pans.
export const HeaderScrollGestureContext = createContext<GestureType[]>([]);
