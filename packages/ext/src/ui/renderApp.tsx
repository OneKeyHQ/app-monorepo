import React, { Suspense, lazy } from 'react';

import ReactDOM from 'react-dom';

function renderApp() {
  // FIX: use lazy Component force Modal overlay size calculated after popupSizeFix()
  const App = lazy(() => import('../App'));

  ReactDOM.render(
    <Suspense fallback={<div />}>
      <App />
    </Suspense>,
    window.document.querySelector('#root'),
  );
}

export default renderApp;
