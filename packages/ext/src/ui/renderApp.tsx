// fix missing setimmediate on react-dom
// eslint-disable-next-line import/order
import 'setimmediate';

// eslint-disable-next-line import/order
import { createRoot } from 'react-dom/client';

import App from '../App';

function renderApp() {
  const root = window.document.querySelector('#root');
  if (!root) throw new Error('No root element found!');
  createRoot(root).render(<App />);
}

export default renderApp;
