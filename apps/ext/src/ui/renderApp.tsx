// fix missing setimmediate on react-dom
// eslint-disable-next-line import/order
import 'setimmediate';

// eslint-disable-next-line import/order
import { createRoot } from 'react-dom/client';

import { initSentry } from '@onekeyhq/shared/src/modules3rdParty/sentry';

import App from '../App';

initSentry();

function renderApp() {
  const root = globalThis.document.querySelector('#root');
  if (!root) throw new Error('No root element found!');
  createRoot(root).render(<App />);
}

export default renderApp;
