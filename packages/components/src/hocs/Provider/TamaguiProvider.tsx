import { TamaguiProvider as OGProvider } from '../../shared/tamagui';
import { PortalProvider } from '../../shared/tamagui';

import type { TamaguiProviderProps } from '../../shared/tamagui';

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
