// fix missing setimmediate on react-dom
// eslint-disable-next-line import/order
import 'setimmediate';

// eslint-disable-next-line import/order
import { createRoot } from 'react-dom/client';

import * as Sentry from '@onekeyhq/shared/src/modules3rdParty/sentry';

import App from '../App';

Sentry.init({
  dsn: 'https://fc0d87f5a1ef85df3a6621206fec0357@o4508208799809536.ingest.de.sentry.io/4508320051036240',
  integrations: [],
});

function renderApp() {
  const root = globalThis.document.querySelector('#root');
  if (!root) throw new Error('No root element found!');
  createRoot(root).render(<App />);
}

export default renderApp;
