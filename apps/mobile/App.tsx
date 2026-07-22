import {
  type INativeHomeRenderer,
  KitProvider,
  NativeHomeRendererProvider,
} from '@onekeyhq/kit';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { withSentryHOC } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';

const MobileNativeHomeRenderer: INativeHomeRenderer = LazyLoad(async () => {
  const { MobileNativeHomeRenderer: Renderer } =
    await import('./src/home/MobileNativeHomeRenderer');
  return { default: Renderer };
});

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
