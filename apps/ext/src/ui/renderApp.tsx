// fix missing setimmediate on react-dom
// eslint-disable-next-line import/order
import 'setimmediate';

// eslint-disable-next-line import/order
import { createRoot } from 'react-dom/client';

import {
  initSentry,
  withProfiler,
} from '@onekeyhq/shared/src/modules3rdParty/sentry';

import App from '../App';

initSentry();

const WithProfilerApp = withProfiler(App);

function renderApp() {
  const root = globalThis.document.querySelector('#root');
  if (!root) throw new Error('No root element found!');
  createRoot(root).render(<WithProfilerApp />);
}

export default renderApp;
