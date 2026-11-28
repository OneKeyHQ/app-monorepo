import { useMedia } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS = platformEnv.isNative
  ? ({ pb: '$5' } as const)
  : undefined;

export const PERP_KEYBOARD_AWARE_DIALOG_CONTENT_CONTAINER_PROPS =
  platformEnv.isNative ? ({ pb: 0 } as const) : undefined;

export type IPerpDialogButtonSize = 'large' | 'medium';

export function usePerpDialogButtonSize(): IPerpDialogButtonSize {
  const { md } = useMedia();
  return md ? 'large' : 'medium';
}
