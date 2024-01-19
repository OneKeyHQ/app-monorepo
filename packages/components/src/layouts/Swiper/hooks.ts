import { useCallback, useMemo, useState } from 'react';

import type { ISwiperProps } from './type';
import type { LayoutChangeEvent } from 'react-native';

export const useSharedStyle = (props: ISwiperProps<any>) =>
  useMemo(() => {
    const { height, $md, $gtMd, $lg, $gtLg } = props;
    return {
      height,
      $md,
      $gtMd,
      $lg,
      $gtLg,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

export const useSharedContainerWidth = () => {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);
  return {
    containerWidth,
    onContainerLayout: handleLayout,
  };
};
