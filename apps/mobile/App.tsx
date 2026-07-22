import { KitProvider, NativeHomeRendererProvider } from '@onekeyhq/kit';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { withSentryHOC } from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';

import { MobileNativeHomeRenderer } from './src/home/MobileNativeHomeRenderer';

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
