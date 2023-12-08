import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useWindowDimensions } from 'react-native';

import { getScreenSize } from './device';
import { ContextDeviceScreenSize } from './hooks/useProviderDeviceScreenSize';
import { ContextIsVerticalLayout } from './hooks/useProviderIsVerticalLayout';

function ScreenSizeProvider({ children }: { children?: ReactNode }) {
  const { width } = useWindowDimensions();
  const deviceScreenSize = useMemo(() => getScreenSize(width), [width]);

  const isVerticalLayout = useMemo(
    () => deviceScreenSize === 'SMALL',
    [deviceScreenSize],
  );

  return (
    <ContextDeviceScreenSize.Provider value={deviceScreenSize}>
      <ContextIsVerticalLayout.Provider value={isVerticalLayout}>
        {children}
      </ContextIsVerticalLayout.Provider>
    </ContextDeviceScreenSize.Provider>
  );
}

export default ScreenSizeProvider;
