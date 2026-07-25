import {
  type INativeHomeRenderer,
  KitProvider,
  NativeHomeRendererProvider,
} from '@onekeyhq/kit';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { withSentryHOC } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';

import { useMobileHomeRendererMode } from './src/home/mobileHomeRendererDevSwitch';
import { MobileNativeHomeRenderer as MobileNativeHomeRendererImplementation } from './src/home/MobileNativeHomeRenderer';

const LazyReactHomePageView: INativeHomeRenderer = LazyLoad(async () => {
  const { HomePageView } =
    await import('@onekeyhq/kit/src/views/Home/pages/HomePageView');
  return { default: HomePageView };
});

const MobileNativeHomeRenderer: INativeHomeRenderer = (props) => {
  const rendererMode = useMobileHomeRendererMode();
  if (rendererMode === 'react') {
    return <LazyReactHomePageView {...props} />;
  }
  return <MobileNativeHomeRendererImplementation {...props} />;
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
