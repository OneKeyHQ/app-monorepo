// eslint-disable-next-line import/order
import { createRoot } from 'react-dom/client';

// import App from '../App';

function renderApp() {
  const root = window.document.querySelector('#root');
  if (!root) throw new Error('No root element found!');
  createRoot(root).render(<div>hello, onekey</div>);
}

export default renderApp;
