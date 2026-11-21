import { useCallback } from 'react';
import type { ReactNode } from 'react';

import { SizableText } from '@onekeyhq/components';

// Web: the link is a text span, so it is made focusable, opens on Enter and
// Space like a native link, and hands its element to the anchored panel.
export function OneKeyIdUsageLink({
  children,
  onPress,
  onElementChange,
  expanded,
  controlsId,
}: {
  children: ReactNode;
  onPress: () => void;
  onElementChange: (element: HTMLElement | undefined) => void;
  expanded: boolean;
  controlsId: string;
}) {
  const handleRef = useCallback(
    (node: unknown) => {
      onElementChange(node instanceof HTMLElement ? node : undefined);
    },
    [onElementChange],
  );
  const handleKeyDown = useCallback(
    (event: { key: string; preventDefault: () => void }) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      onPress();
    },
    [onPress],
  );
  return (
    <SizableText
      ref={handleRef}
      testID="prime-login-usage-link"
      size="$bodyLg"
      color="$textSubdued"
      cursor="pointer"
      role="link"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-controls={controlsId}
      tabIndex={0}
      onPress={onPress}
      onKeyDown={handleKeyDown}
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: 2,
      }}
    >
      {children}
    </SizableText>
  );
}
