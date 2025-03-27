import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function useSearchPopoverFeatureFlag() {
  return platformEnv.isDesktop || platformEnv.isExtension || platformEnv.isWeb;
}
