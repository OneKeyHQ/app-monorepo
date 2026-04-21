import { useReducedMotion } from 'react-native-reanimated';

import {
  IconButton,
  useSafeAreaInsets,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';

export type IBackToTopButtonProps = {
  visible: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
};

const BOTTOM_GAP = 16;

export function BackToTopButton({
  visible,
  onPress,
  accessibilityLabel = 'Back to top',
}: IBackToTopButtonProps) {
  const safeArea = useSafeAreaInsets();
  const tabBarOffset = useScrollContentTabBarOffset() ?? 0;
  const bottomOffset = (safeArea?.bottom ?? 0) + tabBarOffset + BOTTOM_GAP;
  const reducedMotion = useReducedMotion();

  return (
    <IconButton
      icon="ArrowTopSolid"
      size="large"
      variant="secondary"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      position="absolute"
      right="$4"
      bottom={bottomOffset}
      zIndex={20}
      animation={reducedMotion ? undefined : 'quick'}
      opacity={visible ? 1 : 0}
      pointerEvents={visible ? 'auto' : 'none'}
    />
  );
}
