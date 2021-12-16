/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import React from 'react';

import ReactDOM from 'react-dom';

import inpageProviderUi from '@onekeyhq/inpage-provider/src/extension/ui';

import App from '../App';
import hotReload from '../ui/hotReload';
import popupSizeFix from '../ui/popupSizeFix';

popupSizeFix();
window.extJsBridgeUiToBg = inpageProviderUi.createUiJsBridge();

ReactDOM.render(<App />, window.document.querySelector('#root'));
hotReload.enable();
