import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS = platformEnv.isNative
  ? ({ pb: '$8' } as const)
  : undefined;
