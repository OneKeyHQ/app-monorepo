import { useReducedMotion } from 'react-native-reanimated';

import {
  IconButton,
  useSafeAreaInsets,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export type IBackToTopButtonProps = {
  visible: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  placement?: 'left' | 'right';
};

const BOTTOM_GAP = 16;

export function BackToTopButton({
  visible,
  onPress,
  accessibilityLabel = 'Back to top',
  placement = 'right',
}: IBackToTopButtonProps) {
  const safeArea = useSafeAreaInsets();
  const tabBarOffset = useScrollContentTabBarOffset() ?? 0;
  const bottomOffset = (safeArea?.bottom ?? 0) + tabBarOffset + BOTTOM_GAP;
  const reducedMotion = useReducedMotion();
  const horizontalPosition =
    placement === 'left'
      ? ({ left: '$4' } as const)
      : ({ right: '$4' } as const);

  return (
    <IconButton
      icon="ArrowTopSolid"
      size="large"
      variant="secondary"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      position={platformEnv.isNative ? 'absolute' : ('fixed' as any)}
      {...horizontalPosition}
      bottom={bottomOffset}
      zIndex={20}
      animation={reducedMotion ? undefined : 'quick'}
      opacity={visible ? 1 : 0}
      pointerEvents={visible ? 'auto' : 'none'}
    />
  );
}
