import { EPageType } from '@onekeyhq/components';
import { RootModalNavigator } from '@onekeyhq/components/src/layouts/Navigation/Navigator';
import type {
  EModalRoutes,
  EOnboardingV2Routes,
} from '@onekeyhq/shared/src/routes';
import type { EFullScreenPushRoutes } from '@onekeyhq/shared/src/routes/fullScreenPush';

import {
  fullScreenPushRouterConfig,
  modalRouter,
  onboardingRouterV2Config,
} from './router';

export function ModalNavigator({ pageType }: { pageType?: EPageType }) {
  return (
    <RootModalNavigator<EModalRoutes>
      config={modalRouter}
      pageType={pageType}
    />
  );
}

export function IOSFullScreenNavigator() {
  return <ModalNavigator pageType={EPageType.fullScreen} />;
}

export function FullScreenPushNavigator() {
  return (
    <RootModalNavigator<EFullScreenPushRoutes>
      config={fullScreenPushRouterConfig}
      pageType={EPageType.fullScreenPush}
    />
  );
}

export function OnboardingNavigator() {
  return (
    <RootModalNavigator<EOnboardingV2Routes>
      config={onboardingRouterV2Config}
      pageType={EPageType.onboarding}
    />
  );
}
