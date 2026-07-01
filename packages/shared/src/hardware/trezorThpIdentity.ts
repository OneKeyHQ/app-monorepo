import platformEnv from '../platformEnv';

type IPlatformIdentityEnv = {
  isDesktop?: boolean;
  isExtension?: boolean;
  isNative?: boolean;
  isWeb?: boolean;
};

export const TREZOR_THP_APP_NAME = 'OneKey Wallet';

export function getTrezorThpHostName(
  env: IPlatformIdentityEnv = platformEnv,
): string {
  if (env.isDesktop) return 'Desktop';
  if (env.isExtension) return 'Extension';
  if (env.isNative) return 'Mobile';
  if (env.isWeb) return 'Web';
  return 'Device';
}

export function getTrezorThpIdentity(env: IPlatformIdentityEnv = platformEnv): {
  appName: string;
  hostName: string;
} {
  return {
    appName: TREZOR_THP_APP_NAME,
    hostName: getTrezorThpHostName(env),
  };
}
