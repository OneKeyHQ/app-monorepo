import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS = platformEnv.isNative
  ? ({ pb: '$5' } as const)
  : undefined;

export const PERP_DIALOG_BUTTON_SIZE = platformEnv.isNative
  ? ('large' as const)
  : ('medium' as const);
