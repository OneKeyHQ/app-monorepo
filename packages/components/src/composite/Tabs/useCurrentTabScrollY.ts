import { useSharedValue } from 'react-native-reanimated';

import type { useCurrentTabScrollY as useCurrentTabScrollYNative } from 'react-native-collapsible-tab-view';

export const useCurrentTabScrollY: typeof useCurrentTabScrollYNative = () => {
  return useSharedValue(0);
};
