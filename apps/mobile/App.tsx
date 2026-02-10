import { KitProvider } from '@onekeyhq/kit';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { withSentryHOC } from '@onekeyhq/shared/src/modules3rdParty/sentry';

const SentryKitProvider = withSentryHOC(KitProvider, SentryErrorBoundaryFallback);

export default function App(props: any) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[LANDING_DEBUG] App render, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`,
    );
  }
  return <SentryKitProvider {...props} />;
}
