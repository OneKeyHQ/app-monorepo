import type { ReactElement } from 'react';

import { Stack } from '@onekeyhq/components';

import type { IChromeHitSlop } from './browserChrome';

// Web/desktop counterpart of ChromePressable.native: a plain press wrapper.
export function ChromePressable({
  onPress,
  disabled,
  fill,
  accessibilityLabel,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  fill?: boolean;
  // Native only (see ChromePressable.native).
  hitSlop?: IChromeHitSlop;
  accessibilityLabel?: string;
  children: ReactElement;
}) {
  return (
    <Stack
      flex={fill ? 1 : undefined}
      alignSelf={fill ? 'stretch' : undefined}
      onPress={disabled ? undefined : onPress}
      role="button"
      aria-label={accessibilityLabel}
      aria-disabled={disabled}
    >
      {children}
    </Stack>
  );
}
