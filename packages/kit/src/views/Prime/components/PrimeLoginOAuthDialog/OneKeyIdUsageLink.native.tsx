import type { ReactNode } from 'react';

import { SizableText } from '@onekeyhq/components';

// Native opens the panel as a sheet, so nothing needs the link's element.
export function OneKeyIdUsageLink({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress: () => void;
  onElementChange: (element: HTMLElement | undefined) => void;
}) {
  return (
    <SizableText
      testID="prime-login-usage-link"
      size="$bodyLg"
      color="$textSubdued"
      onPress={onPress}
    >
      {children}
    </SizableText>
  );
}
