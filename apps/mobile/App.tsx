import { KitProvider } from '@onekeyhq/kit';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { withSentryHOC } from '@onekeyhq/shared/src/modules3rdParty/sentry';

export default withSentryHOC(KitProvider, SentryErrorBoundaryFallback);
