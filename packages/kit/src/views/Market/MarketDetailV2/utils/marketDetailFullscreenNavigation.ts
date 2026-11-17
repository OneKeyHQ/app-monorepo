import type { NavigationAction } from '@react-navigation/routers';

function shouldReplayFullscreenNavigationAction(action: NavigationAction) {
  return action.type === 'REPLACE';
}

export { shouldReplayFullscreenNavigationAction };
