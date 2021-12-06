import React, { FC } from 'react';
import ReactDOM from 'react-dom';

import { Provider } from '@onekeyhq/kit';
import inpageProviderUi from '@onekeyhq/inpage-provider/src/extension/ui';
import hotReload from './hotReload';

import './index.css';

// @ts-ignore
window.jsBridgeUi = inpageProviderUi.createUiJsBridge();

const App: FC = function () {
  return <Provider />;
};

ReactDOM.render(<App />, window.document.querySelector('#root'));

hotReload.enable();
