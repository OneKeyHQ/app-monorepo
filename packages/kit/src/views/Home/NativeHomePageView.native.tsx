import { useNativeHomeRenderer } from './NativeHomeRendererProvider';
import { HomePageView } from './pages/HomePageViewLoader';

import type { INativeHomePageViewProps } from './NativeHomePageView.types';

export function NativeHomePageView({
  sceneName,
  onPressHide,
}: INativeHomePageViewProps) {
  const NativeRenderer = useNativeHomeRenderer();
  if (NativeRenderer) {
    return <NativeRenderer sceneName={sceneName} onPressHide={onPressHide} />;
  }
  return <HomePageView sceneName={sceneName} onPressHide={onPressHide} />;
}
