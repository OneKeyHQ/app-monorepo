import { useWindowDimensions } from 'react-native';

import { useIsSplitView } from '@onekeyhq/components/src/hooks/useOrientation';
// oxlint-disable-next-line import/no-cycle
import { useTabContainerWidth } from '@onekeyhq/components/src/composite/Tabs/hooks';

export const usePageWidth = () => {
  const isSplitting = useIsSplitView();
  const { width: screenWidth } = useWindowDimensions();
  const width = useTabContainerWidth();
  return isSplitting && typeof width === 'number' ? width : screenWidth;
};
