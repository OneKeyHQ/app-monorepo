import { useCallback, useState } from 'react';

import type { LayoutChangeEvent } from 'react-native';

export function useTableAvailableWidth() {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
  }, []);

  return {
    containerWidth,
    onLayout: handleLayout,
  };
}
