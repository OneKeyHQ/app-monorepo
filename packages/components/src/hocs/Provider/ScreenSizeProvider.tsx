import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import { getScreenSize } from './device';
import { ContextIsVerticalLayout } from './hooks/useProviderIsVerticalLayout';

function ScreenSizeProvider({ children }: { children?: ReactNode }) {
  const { width } = useWindowDimensions();
  const deviceScreenSize = useMemo(() => getScreenSize(width), [width]);

  const isVerticalLayout = useMemo(
    () => deviceScreenSize === 'SMALL',
    [deviceScreenSize],
  );

  return (
    <ContextIsVerticalLayout.Provider value={isVerticalLayout}>
      {children}
    </ContextIsVerticalLayout.Provider>
  );
}

export default ScreenSizeProvider;
