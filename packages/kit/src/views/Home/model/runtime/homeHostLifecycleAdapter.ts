import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

export function getHomeHostVisible(): boolean {
  if (platformEnv.isNative) {
    return getCurrentVisibilityState();
  }
  if (typeof document !== 'undefined') {
    return document.visibilityState === 'visible';
  }
  return true;
}

export function subscribeHomeHostVisibility(
  listener: (visible: boolean) => void,
): () => void {
  if (platformEnv.isNative) {
    return onVisibilityStateChange(listener);
  }
  if (typeof document === 'undefined') {
    return () => undefined;
  }
  const handleVisibility = () => {
    listener(document.visibilityState === 'visible');
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}
