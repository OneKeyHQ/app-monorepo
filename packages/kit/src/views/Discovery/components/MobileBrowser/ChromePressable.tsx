import type { ReactElement } from 'react';

import { Stack } from '@onekeyhq/components';

// Web/desktop counterpart of ChromePressable.native: a plain press wrapper.
export function ChromePressable({
  onPress,
  disabled,
  fill,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  fill?: boolean;
  children: ReactElement;
}) {
  return (
    <Stack
      flex={fill ? 1 : undefined}
      alignSelf={fill ? 'stretch' : undefined}
      onPress={disabled ? undefined : onPress}
    >
      {children}
    </Stack>
  );
}
