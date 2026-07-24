import { type PropsWithChildren, PureComponent } from 'react';

import {
  type INativeHomeRenderer,
  KitProvider,
  NativeHomeRendererProvider,
} from '@onekeyhq/kit';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import type { INativeHomePageViewProps } from '@onekeyhq/kit/src/views/Home/NativeHomePageView.types';
import { HomeLaunchSkeleton } from '@onekeyhq/kit/src/views/Home/pages/HomeLaunchSkeleton';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { withSentryHOC } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';

import { useMobileHomeRendererMode } from './src/home/mobileHomeRendererDevSwitch';

const LazyMobileNativeHomeRenderer: INativeHomeRenderer = LazyLoad(
  async () => {
    const { MobileNativeHomeRenderer: Renderer } =
      await import('./src/home/MobileNativeHomeRenderer');
    return { default: Renderer };
  },
  undefined,
  <HomeLaunchSkeleton />,
);

const LazyReactHomePageView: INativeHomeRenderer = LazyLoad(
  async () => {
    const { HomePageView } =
      await import('@onekeyhq/kit/src/views/Home/pages/HomePageView');
    return { default: HomePageView };
  },
  undefined,
  <HomeLaunchSkeleton />,
);

class MobileNativeHomeRendererBoundary extends PureComponent<
  PropsWithChildren<INativeHomePageViewProps>,
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error) {
    defaultLogger.app.error.log(
      `[NativeHome] renderer load failed: ${error.message}`,
    );
  }

  override render() {
    if (this.state.failed) {
      return (
        <LazyReactHomePageView
          sceneName={this.props.sceneName}
          onPressHide={this.props.onPressHide}
        />
      );
    }
    return this.props.children;
  }
}

const MobileNativeHomeRenderer: INativeHomeRenderer = (props) => {
  const rendererMode = useMobileHomeRendererMode();
  if (rendererMode === 'react') {
    return <LazyReactHomePageView {...props} />;
  }
  return (
    <MobileNativeHomeRendererBoundary {...props}>
      <LazyMobileNativeHomeRenderer {...props} />
    </MobileNativeHomeRendererBoundary>
  );
};

const SentryKitProvider = withSentryHOC(
  KitProvider,
  SentryErrorBoundaryFallback,
);

export default function App(props: any) {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('App render');
  }
  return (
    <NativeHomeRendererProvider renderer={MobileNativeHomeRenderer}>
      <SentryKitProvider {...props} />
    </NativeHomeRendererProvider>
  );
}
