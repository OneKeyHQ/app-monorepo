// fix missing setimmediate on react-dom
// eslint-disable-next-line import/order
import 'setimmediate';

// eslint-disable-next-line import/order
import { createRoot } from 'react-dom/client';

import { SentryErrorBoundaryFallback } from '@onekeyhq/kit/src/components/ErrorBoundary';
import { OneKeyPlainTextError } from '@onekeyhq/shared/src/errors';
import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';

import App from '../App';

initSentry();

const WithSentryHOC = withSentryHOC(App, SentryErrorBoundaryFallback);

function renderApp() {
  const root = globalThis.document.querySelector('#root');
  if (!root) throw new OneKeyPlainTextError('No root element found!');
  createRoot(root).render(<WithSentryHOC />);
}

export default renderApp;
