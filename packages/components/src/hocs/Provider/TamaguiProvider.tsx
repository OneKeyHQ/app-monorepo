import {
  OGProvider,
  PortalProvider,
} from '@onekeyhq/components/src/shared/tamagui';
import type { TamaguiProviderProps } from '@onekeyhq/components/src/shared/tamagui';

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
