import ReactDOM from 'react-dom';

import App from '../App';

function renderApp() {
  ReactDOM.render(<App />, window.document.querySelector('#root'));
}

export default renderApp;
