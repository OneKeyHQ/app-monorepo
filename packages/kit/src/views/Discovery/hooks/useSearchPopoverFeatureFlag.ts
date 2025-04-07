import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useSearchPopoverShortcutsFeatureFlag() {
  return platformEnv.isDesktop;
}

export function useSearchPopoverUIFeatureFlag() {
  return platformEnv.isDesktop || platformEnv.isExtension || platformEnv.isWeb;
}
