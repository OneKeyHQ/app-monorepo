// fix missing setimmediate on react-dom
// eslint-disable-next-line import/order
import 'setimmediate';

// eslint-disable-next-line import/order
import ReactDOM from 'react-dom';

import App from '../App';

function renderApp() {
  ReactDOM.render(<App />, window.document.querySelector('#root'));
}

export default renderApp;
