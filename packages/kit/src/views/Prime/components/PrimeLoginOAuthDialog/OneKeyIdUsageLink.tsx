import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { Platform } from 'react-native';

import { SizableText } from '@onekeyhq/components';

export function OneKeyIdUsageLink({
  children,
  onPress,
  onElementChange,
}: {
  children: ReactNode;
  onPress: () => void;
  onElementChange: (element: HTMLElement | undefined) => void;
}) {
  const handleRef = useCallback(
    (node: unknown) => {
      onElementChange(node instanceof HTMLElement ? node : undefined);
    },
    [onElementChange],
  );
  return (
    <SizableText
      // Web: the wide-window panel anchors to the span and opens on hovering
      // it; native opens a sheet and needs neither.
      {...Platform.select({
        web: { ref: handleRef, cursor: 'pointer' as const },
      })}
      testID="prime-login-usage-link"
      size="$bodyLg"
      color="$textSubdued"
      onPress={onPress}
    >
      {children}
    </SizableText>
  );
}
