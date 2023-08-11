import { createRoot } from 'react-dom/client';

import App from '../App';

function renderApp() {
  const root = window.document.querySelector('#root');
  if (!root) throw new Error('No root element found!');
  createRoot(root).render(<App />);
}

export default renderApp;
