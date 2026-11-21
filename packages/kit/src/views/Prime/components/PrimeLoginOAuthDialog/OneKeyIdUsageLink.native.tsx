import type { ReactNode } from 'react';

import { Text } from 'react-native';

// A plain React Native Text keeps its own `onPress`, which screen readers call
// when they activate the link span (TalkBack's click on the span), while
// Tamagui's text only presses through the touch responder. It inherits the
// paragraph's font and color.
export function OneKeyIdUsageLink({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress: () => void;
  onElementChange: (element: HTMLElement | undefined) => void;
}) {
  return (
    <Text
      testID="prime-login-usage-link"
      accessibilityRole="link"
      suppressHighlighting
      onPress={onPress}
    >
      {children}
    </Text>
  );
}
