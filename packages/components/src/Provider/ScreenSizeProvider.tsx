import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useWindowDimensions } from 'tamagui';

import { getScreenSize } from './device';
import { ContextDeviceScreenSize } from './hooks/useProviderDeviceScreenSize';
import { ContextScreenLayout } from './hooks/useProviderScreenLayoutValue';

function ScreenSizeProvider({ children }: { children?: ReactNode }) {
  const { width } = useWindowDimensions();
  const deviceScreenSize = useMemo(() => getScreenSize(width), [width]);

  const isVerticalLayout = useMemo(
    () => deviceScreenSize === 'SMALL',
    [deviceScreenSize],
  );

  const providerDeviceScreenSizeValue = useMemo(
    () => ({
      deviceScreenSize,
    }),
    [deviceScreenSize],
  );

  const providerScreenValue = useMemo(
    () => ({
      isVerticalLayout,
    }),
    [isVerticalLayout],
  );

  return (
    <ContextDeviceScreenSize.Provider value={providerDeviceScreenSizeValue}>
      <ContextScreenLayout.Provider value={providerScreenValue}>
        {children}
      </ContextScreenLayout.Provider>
    </ContextDeviceScreenSize.Provider>
  );
}

export default ScreenSizeProvider;
