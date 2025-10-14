import { TamaguiProvider as OGProvider } from '@tamagui/core';
import { PortalProvider } from '@tamagui/portal';

import type { TamaguiProviderProps } from '@tamagui/core';

export const TamaguiProvider = ({
  children,
  ...props
}: TamaguiProviderProps) => {
  return (
    <OGProvider {...props}>
      <PortalProvider shouldAddRootHost>{children}</PortalProvider>
    </OGProvider>
  );
};
