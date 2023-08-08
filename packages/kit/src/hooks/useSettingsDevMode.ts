import { selectDevMode } from '../store/selectors';

import { useAppSelector } from './useAppSelector';

export function useIsDevModeEnabled() {
  const devModeEnable = useAppSelector(selectDevMode)?.enable;
  return devModeEnable;
}

export function useShowWebEmbedWebviewAgent() {
  const isDevMode = useIsDevModeEnabled();
  const showWebEmbedWebviewAgent =
    useAppSelector(selectDevMode)?.showWebEmbedWebviewAgent;
  return isDevMode && showWebEmbedWebviewAgent;
}
