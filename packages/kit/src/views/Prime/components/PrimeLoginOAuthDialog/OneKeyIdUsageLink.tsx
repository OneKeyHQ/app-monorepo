import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { SizableText } from '@onekeyhq/components';

// Web: hands its span to the anchored panel, which anchors to it and opens on
// hovering it.
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
      ref={handleRef}
      testID="prime-login-usage-link"
      size="$bodyLg"
      color="$textSubdued"
      cursor="pointer"
      onPress={onPress}
    >
      {children}
    </SizableText>
  );
}
