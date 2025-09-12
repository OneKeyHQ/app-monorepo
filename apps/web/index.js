import '@onekeyhq/shared/src/polyfills';
import { registerRootComponent } from 'expo';

import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';
import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { initIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import App from './App';

initSentry();

void initIntercom();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(withSentryHOC(App, SentryErrorBoundaryFallback));
