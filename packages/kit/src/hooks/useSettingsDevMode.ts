import { useAppSelector } from './useAppSelector';

export function useIsDevModeEnabled() {
  const devModeEnable = useAppSelector((s) => s?.settings?.devMode?.enable);
  return devModeEnable;
}

export function useShowWebEmbedWebviewAgent() {
  const isDevMode = useIsDevModeEnabled();
  const showWebEmbedWebviewAgent = useAppSelector(
    (s) => s?.settings?.devMode?.showWebEmbedWebviewAgent,
  );
  return isDevMode && showWebEmbedWebviewAgent;
}
