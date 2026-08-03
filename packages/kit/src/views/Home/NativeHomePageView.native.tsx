import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { useNativeHomeRenderer } from './NativeHomeRendererProvider';

import type { INativeHomePageViewProps } from './NativeHomePageView.types';

export function NativeHomePageView({
  sceneName,
  onPressHide,
}: INativeHomePageViewProps) {
  const NativeRenderer = useNativeHomeRenderer();
  if (NativeRenderer) {
    return <NativeRenderer sceneName={sceneName} onPressHide={onPressHide} />;
  }
  throw new OneKeyLocalError('Native Home renderer is not registered');
}
