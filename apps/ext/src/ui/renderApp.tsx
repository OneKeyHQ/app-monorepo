// fix missing setimmediate on react-dom
// eslint-disable-next-line import/order
import 'setimmediate';

// eslint-disable-next-line import/order
import { createRoot } from 'react-dom/client';

import {
  initSentry,
  withSentryHOC,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';

import App from '../App';

initSentry();

const WithSentryHOC = withSentryHOC(App);

function renderApp() {
  const root = globalThis.document.querySelector('#root');
  if (!root) throw new Error('No root element found!');
  createRoot(root).render(<WithSentryHOC />);
}

export default renderApp;
