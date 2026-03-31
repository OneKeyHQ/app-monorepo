import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ANIMATE_ONLY_OPACITY } from '../utils/animationConstants';

export function useHoverOpacity(isHovering?: boolean) {
  if (!platformEnv.isDesktop) {
    return {
      opacity: 1,
      animation: undefined,
    };
  }

  return {
    opacity: isHovering ? 1 : 0.7,
    animation: 'quick' as const,
    animateOnly: ANIMATE_ONLY_OPACITY,
  };
}
