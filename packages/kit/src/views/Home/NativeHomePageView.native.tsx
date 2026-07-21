import { HomePageView } from './pages/HomePageView';

import type { INativeHomePageViewProps } from './NativeHomePageView.types';

export function NativeHomePageView({
  sceneName,
  onPressHide,
}: INativeHomePageViewProps) {
  return <HomePageView sceneName={sceneName} onPressHide={onPressHide} />;
}
